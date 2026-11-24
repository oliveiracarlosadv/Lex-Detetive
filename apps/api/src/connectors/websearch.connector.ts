import { fetchJson } from '../common/json';
import { formatCnpj, formatCpf, onlyDigits } from '../common/documents';
import { Connector, FoundRecord, SearchQuery } from './types';

/**
 * Buscadores na internet: nome completo e CPF/CNPJ do pesquisado.
 * - Automático: Brave Search (chave gratuita) e/ou SearXNG (metabuscador que consulta Google,
 *   Bing, DuckDuckGo e outros ao mesmo tempo), se configurados.
 * - Sempre: links prontos para conferir no Google, Bing, DuckDuckGo e Yandex.
 * Observação: as APIs oficiais do Google (fechada a novos clientes) e do Bing (encerrada em 2025)
 * não estão disponíveis, e o DuckDuckGo bloqueia consultas automáticas.
 */
const TIMEOUT = 15000;

export interface WebQuery { label: string; q: string; doc: boolean }

/** Monta as buscas exatas: nome entre aspas e documento com e sem pontuação. */
export function webQueries(q: Pick<SearchQuery, 'kind' | 'name' | 'tradeName' | 'cpf' | 'cnpj'>): WebQuery[] {
  const out: WebQuery[] = [];
  const name = (q.name || '').trim();
  if (name.length >= 5) out.push({ label: `nome "${name}"`, q: `"${name}"`, doc: false });
  if (q.kind === 'PJ' && q.tradeName && q.tradeName.trim().toLowerCase() !== name.toLowerCase()) out.push({ label: `nome fantasia "${q.tradeName.trim()}"`, q: `"${q.tradeName.trim()}"`, doc: false });
  const digits = onlyDigits(q.kind === 'PJ' ? q.cnpj : q.cpf);
  if (digits.length === 11 || digits.length === 14) {
    const fmt = digits.length === 11 ? formatCpf(digits) : formatCnpj(digits);
    out.push({ label: `${digits.length === 11 ? 'CPF' : 'CNPJ'} ${fmt}`, q: `"${fmt}" OR "${digits}"`, doc: true });
  }
  return out;
}

export const MANUAL_ENGINES: { name: string; url: (q: string) => string }[] = [
  { name: 'Google', url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { name: 'Bing', url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  { name: 'DuckDuckGo', url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { name: 'Yandex', url: (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}` },
];

const clean = (t: unknown) => String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'página'; } };

export const webSearchConnector: Connector = {
  id: 'buscadores',
  name: 'Buscadores na internet',
  category: 'redes',
  description: 'Nome completo e CPF/CNPJ em buscadores: automático pelo Brave Search e/ou SearXNG (Google, Bing, DuckDuckGo e outros), e links prontos para conferir no Google, Bing, DuckDuckGo e Yandex.',
  capabilities: ['nome', 'cpf', 'cnpj'],
  website: 'https://search.brave.com/',
  async isEnabled() { return { enabled: true }; },
  appliesTo: (q) => webQueries(q).length > 0,
  async search(q, ctx) {
    const queries = webQueries(q);
    const brave = await ctx.setting('social.braveKey');
    const searx = (await ctx.setting('busca.searxngUrl'))?.trim().replace(/\/+$/, '');
    const found = new Map<string, FoundRecord>();
    const notes: string[] = [];
    const docDigits = onlyDigits(q.kind === 'PJ' ? q.cnpj : q.cpf);

    const add = (engine: string, wq: WebQuery, url: string, title: string, snippet: string, date?: string) => {
      if (!url || found.has(url)) return;
      const text = `${title} ${snippet}`;
      const cites = docDigits && onlyDigits(text).includes(docDigits);
      found.set(url, {
        title: `${cites ? `${docDigits.length === 11 ? 'CPF' : 'CNPJ'} citado — ` : ''}${hostOf(url)} — ${clean(title).slice(0, 140) || 'página'}`,
        detail: `${clean(snippet).slice(0, 400)}${clean(snippet) ? ' · ' : ''}busca: ${wq.label} (${engine})`,
        date, url, severity: cites ? 'atencao' : undefined,
      });
    };

    for (const wq of queries) {
      if (brave) {
        try {
          const r = await fetchJson(`https://api.search.brave.com/res/v1/web/search?count=20&country=BR&search_lang=pt-br&q=${encodeURIComponent(wq.q)}`,
            { headers: { 'X-Subscription-Token': brave, Accept: 'application/json' }, timeoutMs: TIMEOUT });
          for (const w of r?.web?.results || []) add('Brave', wq, w.url, w.title, w.description, w.page_age?.slice(0, 10));
        } catch (e: any) { notes.push(`Brave: ${e.status === 401 || e.status === 422 ? 'chave inválida' : e.status === 429 ? 'limite de consultas' : 'sem resposta'}`); }
        await new Promise((res) => setTimeout(res, 1100)); // plano gratuito: 1 consulta por segundo
      }
      if (searx) {
        try {
          const r = await fetchJson(`${searx}/search?format=json&language=pt-BR&q=${encodeURIComponent(wq.q)}`, { timeoutMs: TIMEOUT });
          for (const w of (r?.results || []).slice(0, 25)) add(`SearXNG: ${(w.engines || [w.engine]).filter(Boolean).join(', ')}`, wq, w.url, w.title, w.content, w.publishedDate?.slice(0, 10));
        } catch (e: any) { notes.push(`SearXNG: ${e.status === 403 ? 'o servidor não libera o formato JSON' : 'sem resposta'}`); }
      }
    }
    const auto = [...found.values()].sort((a, b) => Number(b.severity === 'atencao') - Number(a.severity === 'atencao'));

    // Links prontos (sempre): o profissional abre e confere no navegador.
    const manual: FoundRecord[] = queries.flatMap((wq) => MANUAL_ENGINES.map((e) => ({
      title: `${e.name} — abrir busca por ${wq.label}`,
      detail: 'Busca pronta para conferir no navegador.',
      url: e.url(wq.q),
    })));

    const cited = auto.filter((r) => r.severity === 'atencao').length;
    return {
      ok: true,
      processes: [],
      records: [...auto, ...manual],
      message: [
        brave || searx ? `${auto.length} página(s) encontrada(s)${docDigits ? `, ${cited} citando o ${docDigits.length === 11 ? 'CPF' : 'CNPJ'}` : ''}` : 'busca automática não configurada (informe a chave do Brave ou o endereço do SearXNG em Configurações → Fontes)',
        `${manual.length} link(s) prontos para Google, Bing, DuckDuckGo e Yandex`, ...notes,
      ].join('; ') + '.',
    };
  },
};
