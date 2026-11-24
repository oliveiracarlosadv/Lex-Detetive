import { fetchJson } from '../common/json';
import { onlyDigits } from '../common/documents';
import { Connector, FoundRecord, SearchQuery } from './types';
import { webQueries } from './websearch.connector';

/**
 * Diários Oficiais dos Estados. Não existe busca nacional: cada estado publica no próprio portal
 * (e alguns, como o do Pará, estão com a busca fora do ar). Por isso a busca é feita DENTRO do site
 * do diário de cada estado, pelos buscadores: automática com Brave/SearXNG e, sempre, links prontos.
 */
export const DOE_SITES: Record<string, { name: string; sites: string[] }> = {
  AC: { name: 'Acre', sites: ['diario.ac.gov.br'] },
  AL: { name: 'Alagoas', sites: ['imprensaoficial.al.gov.br'] },
  AP: { name: 'Amapá', sites: ['diofe.portal.ap.gov.br'] },
  AM: { name: 'Amazonas', sites: ['diario.imprensaoficial.am.gov.br'] },
  BA: { name: 'Bahia', sites: ['egba.ba.gov.br', 'ba.gov.br/egba'] },
  CE: { name: 'Ceará', sites: ['seplag.ce.gov.br', 'ce.gov.br/diario-oficial'] },
  DF: { name: 'Distrito Federal', sites: ['dodf.df.gov.br'] },
  ES: { name: 'Espírito Santo', sites: ['ioes.dio.es.gov.br'] },
  GO: { name: 'Goiás', sites: ['diariooficial.abc.go.gov.br'] },
  MA: { name: 'Maranhão', sites: ['diariooficial.ma.gov.br'] },
  MT: { name: 'Mato Grosso', sites: ['iomat.mt.gov.br'] },
  MS: { name: 'Mato Grosso do Sul', sites: ['spdo.ms.gov.br', 'diariooficial.ms.gov.br'] },
  MG: { name: 'Minas Gerais', sites: ['jornalminasgerais.mg.gov.br'] },
  PA: { name: 'Pará', sites: ['ioepa.com.br'] },
  PB: { name: 'Paraíba', sites: ['auniao.pb.gov.br'] },
  PR: { name: 'Paraná', sites: ['dioe.pr.gov.br'] },
  PE: { name: 'Pernambuco', sites: ['diariooficial.cepe.com.br'] },
  PI: { name: 'Piauí', sites: ['diario.pi.gov.br'] },
  RJ: { name: 'Rio de Janeiro', sites: ['ioerj.com.br'] },
  RN: { name: 'Rio Grande do Norte', sites: ['diariooficial.rn.gov.br'] },
  RS: { name: 'Rio Grande do Sul', sites: ['diariooficial.rs.gov.br'] },
  RO: { name: 'Rondônia', sites: ['diof.ro.gov.br'] },
  RR: { name: 'Roraima', sites: ['imprensaoficial.rr.gov.br'] },
  SC: { name: 'Santa Catarina', sites: ['doe.sea.sc.gov.br'] },
  SP: { name: 'São Paulo', sites: ['doe.sp.gov.br', 'imprensaoficial.com.br'] },
  SE: { name: 'Sergipe', sites: ['iose.se.gov.br'] },
  TO: { name: 'Tocantins', sites: ['diariooficial.to.gov.br'] },
};

/** UF do tribunal estadual/trabalhista pelo nome (TJPA → PA, TRT8 → PA…). */
const TRT_UF: Record<string, string[]> = { 1: ['RJ'], 2: ['SP'], 3: ['MG'], 4: ['RS'], 5: ['BA'], 6: ['PE'], 7: ['CE'], 8: ['PA', 'AP'], 9: ['PR'], 10: ['DF', 'TO'], 11: ['AM', 'RR'], 12: ['SC'], 13: ['PB'], 14: ['RO', 'AC'], 15: ['SP'], 16: ['MA'], 17: ['ES'], 18: ['GO'], 19: ['AL'], 20: ['SE'], 21: ['RN'], 22: ['PI'], 23: ['MT'], 24: ['MS'] };
export function ufsFromCourts(courts: string[]): string[] {
  const out = new Set<string>();
  for (const c of courts) {
    const tj = /^TJ(DFT|[A-Z]{2})$/.exec(c || '');
    if (tj) out.add(tj[1] === 'DFT' ? 'DF' : tj[1]);
    const trt = /^TRT(\d{1,2})$/.exec(c || '');
    if (trt) (TRT_UF[trt[1]] || []).forEach((u) => out.add(u));
  }
  return [...out].filter((u) => DOE_SITES[u]);
}

export function parseUfs(v?: string | null): string[] {
  return [...new Set((v || '').toUpperCase().split(/[^A-Z]+/).filter((u) => DOE_SITES[u]))];
}

const siteFilter = (uf: string) => DOE_SITES[uf].sites.map((s) => `site:${s}`).join(' OR ');
const clean = (t: unknown) => String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export const doeConnector: Connector = {
  id: 'doe',
  name: 'Diários Oficiais dos Estados',
  category: 'diarios',
  description: 'Nome e CPF/CNPJ dentro do site do Diário Oficial de cada estado escolhido (Configurações → Fontes) e dos estados dos tribunais onde o pesquisado tem processos. Automático com Brave/SearXNG; sempre com links prontos.',
  capabilities: ['nome', 'cpf', 'cnpj'],
  async isEnabled() { return { enabled: true }; },
  appliesTo: (q) => webQueries(q).length > 0,
  async search(q: SearchQuery, ctx) {
    const ufs = [...new Set([...parseUfs((await ctx.setting('diarios.ufs')) || 'PA'), ...ufsFromCourts(q.courts || [])])].slice(0, 8);
    const queries = webQueries(q).filter((w) => !/fantasia/.test(w.label));
    const brave = false; // Brave Search não libera consulta pelo navegador
    const searx = (await ctx.setting('busca.searxngUrl'))?.trim().replace(/\/+$/, '');
    const docDigits = onlyDigits(q.kind === 'PJ' ? q.cnpj : q.cpf);
    const found = new Map<string, FoundRecord>();
    const notes: string[] = [];

    for (const uf of ufs) for (const wq of queries) {
      const query = `${wq.q} (${siteFilter(uf)})`;
      const add = (url: string, title: string, snippet: string, date?: string) => {
        if (!url || found.has(url)) return;
        const cites = docDigits && onlyDigits(`${title} ${snippet}`).includes(docDigits);
        found.set(url, { title: `Diário Oficial do Estado — ${uf}${cites ? ' — documento citado' : ''} — ${clean(title).slice(0, 120)}`, detail: `${clean(snippet).slice(0, 400)} · busca: ${wq.label}`, date, url, severity: cites ? 'atencao' : undefined });
      };
      if (searx) {
        try {
          const r = await fetchJson(`${searx}/search?format=json&language=pt-BR&q=${encodeURIComponent(query)}`, { timeoutMs: 15000 });
          for (const w of (r?.results || []).slice(0, 20)) add(w.url, w.title, w.content, w.publishedDate?.slice(0, 10));
        } catch { notes.push(`SearXNG (${uf}): sem resposta`); }
      }
    }
    const auto = [...found.values()].sort((a, b) => Number(b.severity === 'atencao') - Number(a.severity === 'atencao'));
    const manual: FoundRecord[] = ufs.flatMap((uf) => queries.map((wq) => ({
      title: `Google — abrir busca no Diário Oficial do ${DOE_SITES[uf].name} (${uf}) por ${wq.label}`,
      detail: `Busca pronta dentro de ${DOE_SITES[uf].sites.join(' / ')}.`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`${wq.q} (${siteFilter(uf)})`)}`,
    })));
    return {
      ok: true, processes: [], records: [...auto, ...manual],
      message: [
        `Estados: ${ufs.join(', ') || 'nenhum'}`,
        brave || searx ? `${auto.length} publicação(ões) encontrada(s)` : 'busca automática não configurada (informe o endereço do SearXNG em Configurações → Fontes)',
        `${manual.length} busca(s) pronta(s) no Google`, ...notes,
      ].join('; ') + '.',
    };
  },
};
