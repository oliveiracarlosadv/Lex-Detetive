import { onlyDigits } from '../common/documents';
import { Connector, FoundRecord } from './types';

/** Sanções (CEIS/CNEP) no Portal da Transparência: a API não libera o navegador; o app abre a consulta pronta. */
export const transparenciaConnector: Connector = {
  id: 'transparencia',
  name: 'Portal da Transparência — CEIS/CNEP',
  category: 'sancoes',
  description: 'Sanções administrativas (CEIS e CNEP) por CPF ou CNPJ — consulta pronta no Portal da Transparência.',
  capabilities: ['cpf', 'cnpj'],
  website: 'https://portaldatransparencia.gov.br/sancoes',
  async isEnabled() { return { enabled: true }; },
  appliesTo: (q) => !!(q.cpf || q.cnpj),
  async search(q) {
    const doc = onlyDigits(q.cnpj || q.cpf);
    const records: FoundRecord[] = [
      { title: 'Portal da Transparência — abrir consulta de sanções (CEIS/CNEP)', detail: 'Consulta pronta pelo documento no Portal da Transparência.', url: `https://portaldatransparencia.gov.br/sancoes/consulta?paginacaoSimples=true&tamanhoPagina=&offset=&direcaoOrdenacao=asc&cpfCnpj=${doc}` },
    ];
    return { ok: true, processes: [], records, message: 'Consulta pronta no Portal da Transparência.' };
  },
};
