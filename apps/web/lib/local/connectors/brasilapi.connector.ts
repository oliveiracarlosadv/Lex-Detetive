import { fetchJson } from '../common/json';
import { formatCnpj, isValidCnpj, onlyDigits } from '../common/documents';
import { Connector } from './types';

export function mapCnpj(d: any) {
  return {
    cnpj: formatCnpj(d.cnpj),
    razaoSocial: d.razao_social,
    nomeFantasia: d.nome_fantasia || null,
    situacao: d.descricao_situacao_cadastral,
    dataSituacao: d.data_situacao_cadastral,
    abertura: d.data_inicio_atividade,
    naturezaJuridica: d.natureza_juridica,
    porte: d.porte,
    capitalSocial: d.capital_social,
    atividadePrincipal: d.cnae_fiscal_descricao,
    endereco: [d.descricao_tipo_de_logradouro, d.logradouro, d.numero, d.complemento, d.bairro, d.municipio, d.uf, d.cep]
      .filter(Boolean).join(', '),
    socios: (d.qsa || []).map((s: any) => ({
      nome: s.nome_socio,
      qualificacao: s.qualificacao_socio,
      entrada: s.data_entrada_sociedade,
    })),
  };
}

/** CNPJá (API aberta, sem chave, até 5 consultas por minuto). */
export function mapCnpja(d: any) {
  const a = d.address || {};
  const yn = (o: any) => (o ? (o.optant ? `Sim${o.since ? ` (desde ${String(o.since).split('-').reverse().join('/')})` : ''}` : 'Não') : null);
  return {
    cnpj: formatCnpj(d.taxId),
    razaoSocial: d.company?.name,
    nomeFantasia: d.alias || null,
    situacao: d.status?.text ? String(d.status.text).toUpperCase() : null,
    dataSituacao: d.statusDate,
    abertura: d.founded,
    naturezaJuridica: d.company?.nature?.text,
    porte: d.company?.size?.text,
    capitalSocial: d.company?.equity,
    atividadePrincipal: d.mainActivity?.text,
    atividadesSecundarias: (d.sideActivities || []).map((x: any) => x.text).join('; ') || null,
    simples: yn(d.company?.simples),
    mei: yn(d.company?.simei),
    matriz: d.head === undefined ? null : d.head ? 'Matriz' : 'Filial',
    telefones: (d.phones || []).map((p: any) => `(${p.area}) ${p.number}`).join('; ') || null,
    emails: (d.emails || []).map((e: any) => e.address).join('; ') || null,
    endereco: [a.street, a.number, a.details, a.district, a.city, a.state, a.zip].filter(Boolean).join(', '),
    socios: (d.company?.members || []).map((m: any) => ({ nome: m.person?.name, qualificacao: m.role?.text, entrada: m.since })),
  };
}

/** Junta BrasilAPI (base) com CNPJá (complementa o que faltar e acrescenta Simples, MEI, contatos…). */
export function mergeCnpj(a: Record<string, any> | null, b: Record<string, any> | null) {
  if (!a) return b;
  if (!b) return a;
  const out: Record<string, any> = { ...b, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))) };
  if (!a.socios?.length && b.socios?.length) out.socios = b.socios;
  return out;
}

/** Consulta o CNPJ nas duas APIs públicas ao mesmo tempo; basta uma responder. */
export async function lookupCnpj(cnpjRaw: string) {
  const cnpj = onlyDigits(cnpjRaw);
  if (!isValidCnpj(cnpj)) throw Object.assign(new Error('CNPJ inválido.'), { status: 400 });
  const [ba, cj] = await Promise.allSettled([
    fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeoutMs: 15000 }),
    fetchJson(`https://open.cnpja.com/office/${cnpj}`, { timeoutMs: 15000 }),
  ]);
  const rawA = ba.status === 'fulfilled' ? ba.value : null;
  const rawB = cj.status === 'fulfilled' ? cj.value : null;
  const okA = rawA ? mapCnpj(rawA) : null;
  const okB = rawB ? mapCnpja(rawB) : null;
  if (!okA && !okB) {
    const e: any = (ba as PromiseRejectedResult).reason;
    if (e?.status === 404 || (cj as PromiseRejectedResult).reason?.status === 404) throw Object.assign(new Error('CNPJ não encontrado na Receita Federal.'), { status: 404 });
    throw e;
  }
  // Endereço em partes (para preencher cadastros).
  const ad = rawB?.address;
  const address = rawA ? {
    zip: rawA.cep, street: [rawA.descricao_tipo_de_logradouro, rawA.logradouro].filter(Boolean).join(' '), number: rawA.numero,
    complement: rawA.complemento, district: rawA.bairro, city: rawA.municipio, state: rawA.uf,
  } : ad ? { zip: ad.zip, street: ad.street, number: ad.number, complement: ad.details, district: ad.district, city: ad.city, state: ad.state } : null;
  const phones = (rawB?.phones || []).map((p: any) => `(${p.area}) ${p.number}`);
  if (!phones.length && rawA?.ddd_telefone_1) phones.push(rawA.ddd_telefone_1);
  const emails = (rawB?.emails || []).map((e: any) => e.address).concat(rawA?.email ? [rawA.email] : []);
  return { registry: mergeCnpj(okA, okB)!, sources: [okA && 'BrasilAPI', okB && 'CNPJá'].filter(Boolean) as string[], address, phones, emails: [...new Set(emails.map((e: string) => e.toLowerCase()))] };
}

export const brasilApiConnector: Connector = {
  id: 'receita-cnpj',
  name: 'Receita Federal — CNPJ (BrasilAPI e CNPJá)',
  category: 'cadastral',
  description: 'Dados cadastrais públicos do CNPJ por duas APIs abertas (BrasilAPI e CNPJá): razão social, situação, endereço, atividades, Simples/MEI, contatos e quadro de sócios (QSA).',
  capabilities: ['cnpj'],
  website: 'https://brasilapi.com.br/docs#tag/CNPJ',
  async isEnabled() {
    return { enabled: true };
  },
  appliesTo: (q) => q.kind === 'PJ' && !!q.cnpj,
  async search(q) {
    const cnpj = onlyDigits(q.cnpj);
    if (!isValidCnpj(cnpj)) return { ok: false, message: 'CNPJ inválido.', processes: [] };
    const { registry, sources } = await lookupCnpj(cnpj);
    const records = registry.situacao && registry.situacao !== 'ATIVA'
      ? [{ title: `Situação cadastral: ${registry.situacao}`, date: registry.dataSituacao, severity: 'atencao' as const }]
      : [];
    return { ok: true, processes: [], registry, records, message: `Dados de ${sources.join(' e ')}.` };
  },
};
