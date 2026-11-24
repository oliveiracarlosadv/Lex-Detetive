import { formatCnpj, formatCpf, onlyDigits } from '../common/documents';
import { USER_AGENT } from '../common/json';
import { Connector, FoundRecord } from './types';

/** Diário Oficial da União (Imprensa Nacional) — busca textual pública. */
const SECTIONS: Record<string, string> = { DO1: 'Seção 1', DO2: 'Seção 2', DO3: 'Seção 3', DO1E: 'Seção 1 (extra)', DO2E: 'Seção 2 (extra)', DO3E: 'Seção 3 (extra)' };

export function parseDouHtml(html: string): any[] {
  const m = html.match(/BuscaDouPortlet_params" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return [];
  try { return JSON.parse(m[1]).jsonArray || []; } catch { return []; }
}

const strip = (s: string) => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export const douConnector: Connector = {
  id: 'dou',
  name: 'Diário Oficial da União',
  category: 'diarios',
  description: 'Publicações do DOU (atos, contratos, licitações, sanções, nomeações) por nome ou CNPJ.',
  capabilities: ['nome', 'cpf', 'cnpj'],
  website: 'https://www.in.gov.br/consulta',
  async isEnabled() {
    return { enabled: true };
  },
  appliesTo: (q) => !!(q.name || q.cnpj || q.cpf),
  async search(q) {
    const terms = [q.name && `"${q.name.trim()}"`, q.cnpj && `"${formatCnpj(onlyDigits(q.cnpj))}"`, q.cpf && onlyDigits(q.cpf).length === 11 && `"${formatCpf(q.cpf)}"`].filter(Boolean) as string[];
    const records: FoundRecord[] = [];
    for (const term of terms) {
      const url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(term)}&s=todos&exactDate=all&sortType=0`;
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} no DOU`);
      for (const it of parseDouHtml(await res.text()).slice(0, 20)) {
        const [d, mth, y] = String(it.pubDate || '').split('/');
        records.push({
          title: `DOU ${SECTIONS[it.pubName] || it.pubName} — ${strip(it.title)}`,
          detail: strip(it.content).slice(0, 600),
          date: y ? `${y}-${mth}-${d}` : undefined,
          url: it.urlTitle ? `https://www.in.gov.br/web/dou/-/${it.urlTitle}` : undefined,
        });
      }
    }
    const unique = [...new Map(records.map((r) => [r.url || r.title, r])).values()];
    return { ok: true, processes: [], records: unique, message: `${unique.length} publicação(ões) no DOU.` };
  },
};
