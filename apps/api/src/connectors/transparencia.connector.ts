import { fetchJson } from '../common/json';
import { onlyDigits } from '../common/documents';
import { Connector, FoundRecord } from './types';

const BASE = 'https://api.portaldatransparencia.gov.br/api-de-dados';

/** Cadastros de sanções da CGU: CEIS (inidôneas/suspensas) e CNEP (punidas pela Lei Anticorrupção). */
export const transparenciaConnector: Connector = {
  id: 'transparencia',
  name: 'Portal da Transparência — CEIS/CNEP',
  category: 'sancoes',
  description: 'Sanções administrativas (CEIS e CNEP) por CPF ou CNPJ. Exige chave gratuita da API do Portal da Transparência.',
  capabilities: ['cpf', 'cnpj'],
  requiresSetting: 'transparencia.apiKey',
  website: 'https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email',
  async isEnabled(ctx) {
    return (await ctx.setting('transparencia.apiKey')) ? { enabled: true } : { enabled: false, reason: 'Informe a chave da API em Configurações.' };
  },
  appliesTo: (q) => !!(q.cpf || q.cnpj),
  async search(q, ctx) {
    const key = (await ctx.setting('transparencia.apiKey'))!;
    const doc = onlyDigits(q.cnpj || q.cpf);
    const records: FoundRecord[] = [];
    for (const cadastro of ['ceis', 'cnep'] as const) {
      const list = await fetchJson(`${BASE}/${cadastro}?codigoSancionado=${doc}&pagina=1`, {
        headers: { 'chave-api-dados': key, Accept: 'application/json' },
      });
      for (const s of list || []) {
        records.push({
          title: `${cadastro.toUpperCase()}: ${s.tipoSancao?.descricaoResumida || 'Sanção'}`,
          detail: [s.orgaoSancionador?.nome, s.fundamentacao?.[0]?.descricao, s.dataFimSancao ? `vigente até ${s.dataFimSancao}` : null]
            .filter(Boolean).join(' · '),
          date: s.dataInicioSancao,
          severity: 'critico',
        });
      }
    }
    return { ok: true, processes: [], records, message: records.length ? undefined : 'Nenhuma sanção encontrada no CEIS/CNEP.' };
  },
};
