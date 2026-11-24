import { fetchJson } from '../common/json';
import { courtFromCnj, formatCnj, isValidCnj, onlyDigits } from '../common/documents';
import { DATAJUD_PUBLIC_KEY } from '../system/settings.service';
import { Connector, FoundProcess } from './types';

/** Alias do índice DataJud para cada tribunal (STF não está no DataJud). */
export function datajudAlias(court: string): string | null {
  if (court === 'STF') return null;
  return 'api_publica_' + court.toLowerCase();
}

const BAIXA = /(baixa definitiva|arquivamento definitivo|arquivado definitivamente|baixado)/i;

export function mapDatajudHit(src: any, court: string): FoundProcess {
  const movements = (src.movimentos || [])
    .map((m: any) => ({
      date: m.dataHora,
      code: m.codigo ? String(m.codigo) : undefined,
      description: [m.nome, ...(m.complementosTabelados || []).map((c: any) => c.nome || c.descricao).filter(Boolean)].join(' — '),
    }))
    .filter((m: any) => m.date && m.description)
    .sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
  const last = movements[0];
  return {
    number: formatCnj(src.numeroProcesso),
    court: src.tribunal || court,
    system: src.sistema?.nome,
    className: src.classe?.nome,
    subjects: (src.assuntos || []).flat().map((a: any) => a?.nome).filter(Boolean),
    organ: src.orgaoJulgador?.nome,
    degree: src.grau,
    status: last && BAIXA.test(last.description) ? 'baixado' : 'ativo',
    filedAt: src.dataAjuizamento ? normalizeDate(src.dataAjuizamento) : undefined,
    movements,
    raw: { ...src, movimentos: undefined },
  };
}

/** DataJud usa às vezes "20230115000000" em vez de ISO. */
function normalizeDate(v: string): string {
  if (/^\d{14}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(8, 10)}:${v.slice(10, 12)}:${v.slice(12, 14)}`;
  return v;
}

export const datajudConnector: Connector = {
  id: 'datajud',
  name: 'CNJ DataJud',
  category: 'judicial',
  description:
    'API pública do CNJ com metadados e movimentações de processos de todos os tribunais (exceto STF). Consulta por número CNJ; a API pública não permite busca por nome ou CPF das partes.',
  capabilities: ['processo'],
  website: 'https://datajud-wiki.cnj.jus.br/api-publica/',
  async isEnabled() {
    return { enabled: true };
  },
  appliesTo: (q) => !!q.processNumbers?.some((n) => onlyDigits(n).length === 20),
  async search(q, ctx) {
    const key = (await ctx.setting('datajud.apiKey')) || DATAJUD_PUBLIC_KEY;
    const processes: FoundProcess[] = [];
    const errors: string[] = [];
    const notFound: string[] = [];
    for (const raw of q.processNumbers || []) {
      const digits = onlyDigits(raw);
      if (!isValidCnj(digits)) { errors.push(`${raw}: número CNJ inválido`); continue; }
      const court = courtFromCnj(digits);
      const alias = court && datajudAlias(court);
      if (!alias) { errors.push(`${formatCnj(digits)}: tribunal ${court || 'desconhecido'} não disponível no DataJud`); continue; }
      try {
        const data = await fetchJson(`https://api-publica.datajud.cnj.jus.br/${alias}/_search`, {
          method: 'POST',
          headers: { Authorization: `APIKey ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: { match: { numeroProcesso: digits } }, size: 10 }),
        });
        const hits = data?.hits?.hits || [];
        if (!hits.length) notFound.push(`${formatCnj(digits)}: não encontrado no ${court} (inexistente ou em segredo de justiça)`);
        // Um processo pode ter um registro por grau; juntamos as movimentações.
        const merged = new Map<string, FoundProcess>();
        for (const h of hits) {
          const p = mapDatajudHit(h._source, court!);
          const prev = merged.get(p.number);
          if (!prev) merged.set(p.number, p);
          else {
            prev.movements = [...prev.movements, ...p.movements].sort((a, b) => (a.date < b.date ? 1 : -1));
            prev.degree = [prev.degree, p.degree].filter(Boolean).join(', ');
          }
        }
        processes.push(...merged.values());
      } catch (e) {
        errors.push(`${formatCnj(digits)}: ${e.message}`);
      }
    }
    const message = [...errors, ...notFound].join(' | ') || undefined;
    return { ok: errors.length === 0 || processes.length > 0, message, processes };
  },
};
