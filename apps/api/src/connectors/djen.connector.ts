import { fetchJson } from '../common/json';
import { formatCnj, onlyDigits } from '../common/documents';
import { fixCase } from '../reports/report.builder';
import { cleanText } from '../common/text';
import { checkPublication, DocCheck, mergeChecks } from '../common/doc-match';
import { Connector, FoundParty, FoundProcess } from './types';

/**
 * DJEN — Diário de Justiça Eletrônico Nacional (CNJ, Comunica PJe).
 * Diário oficial dos tribunais: intimações, citações, editais e demais comunicações
 * processuais. Permite busca por nome da parte, OAB e número do processo.
 */
const API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/** Evita homônimos parciais: todas as palavras do nome buscado precisam estar no destinatário. */
export function nameMatches(searched: string, candidate: string) {
  const words = norm(searched).split(' ').filter((w) => w.length > 2 && !['ltda', 'eireli', 'me', 'epp'].includes(w));
  const c = ` ${norm(candidate)} `;
  return words.length > 0 && words.every((w) => c.includes(` ${w} `));
}

const clean = (t: string) => (t || '').replace(/\s+/g, ' ').trim();

export function mapDjenItems(items: any[], check?: (it: any) => DocCheck | undefined): FoundProcess[] {
  const byNumber = new Map<string, FoundProcess>();
  for (const it of items) {
    const number = it.numeroprocessocommascara || formatCnj(String(it.numero_processo || ''));
    if (!number) continue;
    const parties: FoundParty[] = (it.destinatarios || []).map((d: any) => ({
      name: cleanText(d.nome),
      role: d.polo === 'A' ? 'Polo ativo (autor)' : d.polo === 'P' ? 'Polo passivo (réu)' : 'Destinatário',
    }));
    const lawyers = (it.destinatarioadvogados || []).map((a: any) => `${a.advogado?.nome} (OAB/${a.advogado?.uf_oab} ${a.advogado?.numero_oab})`);
    if (lawyers.length) parties.push({ name: lawyers.join('; '), role: 'Advogados intimados', lawyers });
    const rawHead = `${it.tipoComunicacao || 'Comunicação'} publicada no DJEN${it.tipoDocumento ? ` (${it.tipoDocumento})` : ''}: `;
    const head = `${cleanText(it.tipoComunicacao) || 'Comunicação'} publicada no DJEN${it.tipoDocumento ? ` (${cleanText(it.tipoDocumento)})` : ''}: `;
    const cut = (t: string) => `${t.slice(0, 600)}${t.length > 600 ? '…' : ''}`;
    const movement = {
      date: `${it.data_disponibilizacao}T12:00:00.000Z`,
      code: `DJEN-${it.id}`,
      description: head + cut(cleanText(it.texto)),
      // Identificação calculada sobre o texto bruto, como nas versões anteriores (evita alertas repetidos).
      fingerprintText: rawHead + cut(clean(it.texto)),
    };
    const dc = check?.(it);
    const prev = byNumber.get(number);
    if (prev) {
      if (dc) prev.docCheck = mergeChecks(prev.docCheck, dc);
      prev.movements.push(movement);
      for (const p of parties) if (!prev.parties!.some((x) => x.name === p.name)) prev.parties!.push(p);
      continue;
    }
    byNumber.set(number, {
      number, court: it.siglaTribunal, organ: cleanText(it.nomeOrgao), className: fixCase(it.nomeClasse),
      parties, movements: [movement], url: it.link, status: 'ativo', docCheck: dc,
      raw: { fonte: 'DJEN', comunicacao: it.id, link: it.link, meio: it.meiocompleto },
    });
  }
  for (const p of byNumber.values()) p.movements.sort((a, b) => (a.date < b.date ? 1 : -1));
  return [...byNumber.values()];
}

const DOC_ORDER: Record<string, number> = { confirmado: 0, nao_informado: 1, divergente: 2 };

const PAGE = 100;
/** Máximo de páginas por consulta: cobre 500 publicações sem sobrecarregar máquinas modestas. */
export const MAX_PAGES = 5;

/** Busca página a página (em sequência, para poupar memória) até acabar ou atingir MAX_PAGES. */
async function query(params: Record<string, string>, filter: (it: any) => boolean = () => true) {
  const out: any[] = [];
  let total = 0;
  for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
    const qs = new URLSearchParams({ pagina: String(pagina), itensPorPagina: String(PAGE), ...params });
    const data = await fetchJson(`${API}?${qs}`, { timeoutMs: 30000 });
    const items = (data?.items || []) as any[];
    total += items.length;
    // Guarda só o que interessa e descarta o resto da página imediatamente.
    for (const it of items) if (filter(it)) out.push(it);
    if (items.length < PAGE) break;
    await new Promise((r) => setTimeout(r, 700)); // espaço entre páginas: evita bloqueio por excesso de consultas
  }
  return { items: out, total };
}

export const djenConnector: Connector = {
  id: 'djen',
  name: 'DJEN — Diário de Justiça Eletrônico Nacional (CNJ) · fonte principal',
  category: 'diarios',
  description: 'Diário oficial dos tribunais: intimações, citações e editais publicados por todos os tribunais integrados ao CNJ. Busca por nome da parte, OAB e número do processo.',
  capabilities: ['nome', 'processo'],
  website: 'https://comunica.pje.jus.br/',
  async isEnabled() {
    return { enabled: true };
  },
  appliesTo: (q) => !!(q.name || q.tradeName || q.oab || q.processNumbers?.length),
  async search(q) {
    // Primeira busca: últimos 5 anos. Monitoramento: últimos 30 dias.
    const since = new Date(Date.now() - (q.incremental ? 30 : 5 * 365) * 86400000).toISOString().slice(0, 10);
    const items: any[] = [];
    const notes: string[] = [];
    const names = [q.name, q.tradeName].filter(Boolean) as string[];
    for (const name of names) {
      const { items: matched, total } = await query(
        { nomeParte: name, dataDisponibilizacaoInicio: since },
        (it) => (it.destinatarios || []).some((d: any) => nameMatches(name, d.nome)),
      );
      items.push(...matched);
      if (total > matched.length) notes.push(`${total - matched.length} publicação(ões) de nomes parecidos descartadas`);
    }
    if (q.oab) {
      const [numero, uf] = q.oab.split('/').map((s) => s.trim());
      if (numero && uf) items.push(...(await query({ numeroOab: onlyDigits(numero), ufOab: uf.toUpperCase(), dataDisponibilizacaoInicio: since })).items);
    }
    for (const n of q.processNumbers || []) {
      if (onlyDigits(n).length === 20) items.push(...(await query({ numeroProcesso: onlyDigits(n) })).items);
    }
    const unique = [...new Map(items.map((it) => [it.id, it])).values()];
    // Homônimos: confere o CPF/CNPJ cadastrado no texto completo de cada publicação.
    const doc = q.kind === 'PF' ? q.cpf : q.cnpj;
    const checkNames = [q.name, q.tradeName].filter(Boolean) as string[];
    const processes = mapDjenItems(unique, doc && checkNames.length ? (it) => checkNames.map((n) => checkPublication(it.texto || '', n, doc)).reduce<DocCheck | undefined>((a, b) => mergeChecks(a, b), undefined) : undefined);
    processes.sort((a, b) => (DOC_ORDER[a.docCheck?.status || 'nao_informado'] - DOC_ORDER[b.docCheck?.status || 'nao_informado']));
    const conf = processes.filter((p) => p.docCheck?.status === 'confirmado').length;
    const div = processes.filter((p) => p.docCheck?.status === 'divergente').length;
    if (doc) notes.unshift(`CPF/CNPJ: ${conf} confirmado(s), ${div} diferente(s) do cadastrado`);
    return {
      ok: true,
      processes,
      message: `${unique.length} publicação(ões) em ${processes.length} processo(s)${notes.length ? ` · ${notes.join(' · ')}` : ''}. Homônimos são possíveis: confira as partes.`,
    };
  },
};
