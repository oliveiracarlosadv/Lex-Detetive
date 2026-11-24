import { fetchJson } from '../common/json';
import { formatCnpj, formatCpf, onlyDigits } from '../common/documents';
import { Connector, FoundRecord } from './types';

/** Querido Diário (Open Knowledge Brasil): diários oficiais municipais com busca textual. */
export const queridoDiarioConnector: Connector = {
  id: 'querido-diario',
  name: 'Diários Oficiais Municipais (Querido Diário)',
  category: 'diarios',
  description: 'Busca textual em diários oficiais de municípios brasileiros. Útil para nomeações, licitações, contratos e publicações.',
  capabilities: ['nome', 'cpf', 'cnpj'],
  website: 'https://queridodiario.org.br/',
  async isEnabled() {
    return { enabled: true };
  },
  appliesTo: (q) => !!(q.name || q.cnpj || q.cpf),
  async search(q) {
    const terms = [q.name && `"${q.name.trim()}"`, q.cnpj && `"${formatCnpj(onlyDigits(q.cnpj))}"`, q.cpf && onlyDigits(q.cpf).length === 11 && `"${formatCpf(q.cpf)}"`].filter(Boolean) as string[];
    // O servidor costuma levar de 20 a 40 s por busca: cada termo vai separado e ao mesmo tempo,
    // com até 60 s; um erro momentâneo (5xx/tempo esgotado) ganha uma segunda tentativa.
    const one = async (term: string) => {
      const url = `https://api.queridodiario.org.br/gazettes?querystring=${encodeURIComponent(term)}&excerpt_size=400&number_of_excerpts=2&size=15&sort_by=descending_date`;
      try { return await fetchJson(url, { timeoutMs: 60000 }); }
      catch (e: any) {
        if (e.status && e.status < 500) throw e;
        await new Promise((r) => setTimeout(r, 3000));
        return fetchJson(url, { timeoutMs: 60000 });
      }
    };
    const results = await Promise.allSettled(terms.map(one));
    const ok = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled').map((r) => r.value);
    if (!ok.length) throw (results[0] as PromiseRejectedResult).reason;
    const seen = new Set<string>();
    const records: FoundRecord[] = ok.flatMap((data) => data?.gazettes || []).filter((g: any) => {
      const k = `${g.url}|${g.date}`; if (seen.has(k)) return false; seen.add(k); return true;
    }).map((g: any) => ({
      title: `Diário Oficial — ${g.territory_name}/${g.state_code}${g.is_extra_edition ? ' (edição extra)' : ''}`,
      detail: (g.excerpts || []).map((e: string) => e.replace(/\s+/g, ' ').trim()).join(' … ').slice(0, 700),
      date: g.date,
      url: g.url,
    }));
    const failed = results.length - ok.length;
    return {
      ok: true,
      processes: [],
      records,
      message: `${records.length} publicação(ões) encontrada(s)${failed ? `; ${failed} busca(s) sem resposta do servidor` : ''}.`,
    };
  },
};
