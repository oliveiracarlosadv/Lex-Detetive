import { formatCnpj, formatCpf, onlyDigits } from '../common/documents';
import { Connector, FoundRecord } from './types';

/**
 * Diário Oficial da União. O site da Imprensa Nacional não libera consulta direta pelo navegador,
 * então o app monta as buscas prontas (abrem no site oficial com um clique).
 */
export const douConnector: Connector = {
  id: 'dou',
  name: 'Diário Oficial da União',
  category: 'diarios',
  description: 'Publicações do DOU (atos, contratos, licitações, sanções, nomeações) por nome, CPF ou CNPJ — buscas prontas no site da Imprensa Nacional.',
  capabilities: ['nome', 'cpf', 'cnpj'],
  website: 'https://www.in.gov.br/consulta',
  async isEnabled() { return { enabled: true }; },
  appliesTo: (q) => !!(q.name || q.cnpj || q.cpf),
  async search(q) {
    const terms: [string, string][] = [];
    if (q.name) terms.push([`nome "${q.name.trim()}"`, `"${q.name.trim()}"`]);
    if (q.cnpj && onlyDigits(q.cnpj).length === 14) terms.push([`CNPJ ${formatCnpj(onlyDigits(q.cnpj))}`, `"${formatCnpj(onlyDigits(q.cnpj))}"`]);
    if (q.cpf && onlyDigits(q.cpf).length === 11) terms.push([`CPF ${formatCpf(q.cpf)}`, `"${formatCpf(q.cpf)}"`]);
    const records: FoundRecord[] = terms.map(([label, t]) => ({
      title: `DOU — abrir busca por ${label}`,
      detail: 'Busca pronta no site da Imprensa Nacional (o site não permite consulta automática pelo navegador).',
      url: `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(t)}&s=todos&exactDate=all&sortType=0`,
    }));
    return { ok: true, processes: [], records, message: `${records.length} busca(s) pronta(s) no DOU.` };
  },
};
