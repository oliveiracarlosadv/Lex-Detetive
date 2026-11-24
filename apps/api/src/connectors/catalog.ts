/**
 * Catálogo de fontes do Lex Detetive. "integrado" = consulta automática disponível;
 * "manual" = link para consulta no site oficial; "planejado" = conector previsto no roadmap.
 */
export type SourceStatus = 'integrado' | 'manual' | 'planejado';
export interface SourceInfo { id: string; name: string; group: string; system?: string; status: SourceStatus; via?: string; url?: string; note?: string }

const UF_TJ: [string, string][] = [
  ['TJAC','Eproc'],['TJAL','e-SAJ'],['TJAM','e-SAJ / PJe'],['TJAP','Tucujuris / PJe'],['TJBA','PJe'],['TJCE','e-SAJ / PJe'],['TJDFT','PJe'],
  ['TJES','PJe'],['TJGO','Projudi / PJe'],['TJMA','PJe'],['TJMG','PJe / Eproc'],['TJMS','e-SAJ'],['TJMT','PJe'],['TJPA','PJe'],
  ['TJPB','PJe'],['TJPE','PJe'],['TJPI','PJe'],['TJPR','Projudi'],['TJRJ','PJe / DCP'],['TJRN','PJe'],['TJRO','PJe'],
  ['TJRR','Projudi / PJe'],['TJRS','Eproc'],['TJSC','Eproc'],['TJSE','Sistema próprio'],['TJSP','e-SAJ'],['TJTO','Eproc'],
];

const judicial: SourceInfo[] = [
  { id: 'STF', name: 'Supremo Tribunal Federal', group: 'Tribunais Superiores', status: 'manual', url: 'https://portal.stf.jus.br/', note: 'Não integra o DataJud.' },
  ...['STJ', 'TST', 'TSE', 'STM'].map((c) => ({ id: c, name: c, group: 'Tribunais Superiores', status: 'integrado' as const, via: 'CNJ DataJud' })),
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ id: `TRF${n}`, name: `TRF da ${n}ª Região`, group: 'Justiça Federal', system: 'PJe / Eproc', status: 'integrado' as const, via: 'CNJ DataJud' })),
  ...UF_TJ.map(([c, system]) => ({ id: c, name: c, group: 'Justiça Estadual', system, status: 'integrado' as const, via: 'CNJ DataJud' })),
  ...Array.from({ length: 24 }, (_, i) => ({ id: `TRT${i + 1}`, name: `TRT da ${i + 1}ª Região`, group: 'Justiça do Trabalho', system: 'PJe', status: 'integrado' as const, via: 'CNJ DataJud' })),
  { id: 'SEEU', name: 'SEEU — Execução Penal', group: 'Sistemas', status: 'planejado', note: 'Acesso restrito a usuários credenciados.' },
  { id: 'BNMP', name: 'BNMP — Banco Nacional de Mandados de Prisão', group: 'CNJ', status: 'manual', url: 'https://portalbnmp.cnj.jus.br/#/pesquisa-peca', note: 'Consulta pública com captcha; aberta pelo botão na tela de pesquisa.' },
];

const extrajudicial: SourceInfo[] = [
  { id: 'receita-cnpj', name: 'Receita Federal — CNPJ e QSA', group: 'Cadastral', status: 'integrado', via: 'BrasilAPI e CNPJá (APIs abertas)' },
  { id: 'transparencia', name: 'Portal da Transparência — CEIS/CNEP', group: 'Sanções', status: 'integrado', via: 'API CGU (chave gratuita)' },
  { id: 'querido-diario', name: 'Diários Oficiais Municipais', group: 'Diários Oficiais', status: 'integrado', via: 'Querido Diário' },
  { id: 'djen', name: 'DJEN — Diário de Justiça Eletrônico Nacional (diário dos tribunais)', group: 'Diários Oficiais', status: 'integrado', via: 'CNJ Comunica PJe' },
  { id: 'dou', name: 'Diário Oficial da União', group: 'Diários Oficiais', status: 'integrado', via: 'Imprensa Nacional' },
  { id: 'redes-sociais', name: 'Redes sociais e perfis públicos', group: 'Redes sociais', status: 'integrado', via: 'GitHub, Bluesky, X, YouTube, Telegram, Mastodon e outros', note: 'Instagram, Facebook, TikTok e LinkedIn exigem login: o app gera o link para conferência manual.' },
  { id: 'buscadores', name: 'Buscadores na internet (nome e CPF/CNPJ)', group: 'Internet', status: 'integrado', via: 'Brave Search e SearXNG (opcionais) + links para Google, Bing, DuckDuckGo e Yandex', note: 'APIs do Google (fechada a novos clientes) e do Bing (encerrada em 2025) não estão disponíveis; DuckDuckGo bloqueia consultas automáticas.' },
  { id: 'doe', name: 'Diários Oficiais dos Estados (27 UFs)', group: 'Diários Oficiais', status: 'integrado', via: 'Busca no site de cada diário estadual (Brave/SearXNG) + links prontos', note: 'Sem API nacional; estados escolhidos em Configurações → Fontes e estados dos tribunais dos processos.' },
  { id: 'protesto', name: 'Protestos (CENPROT)', group: 'Cartórios', status: 'manual', url: 'https://www.pesquisaprotesto.com.br/', note: 'Consulta gratuita indica cartórios; certidão é paga.' },
  { id: 'registro-civil', name: 'Registro Civil (CRC Nacional)', group: 'Cartórios', status: 'manual', url: 'https://www.registrocivil.org.br/' },
  { id: 'imoveis', name: 'Registro de Imóveis (ONR/SAEC)', group: 'Cartórios', status: 'manual', url: 'https://registradores.onr.org.br/' },
  { id: 'rtd', name: 'Títulos e Documentos (RTDBrasil)', group: 'Cartórios', status: 'manual', url: 'https://www.rtdbrasil.org.br/' },
  { id: 'juntas', name: 'Juntas Comerciais (REDESIM)', group: 'Cadastral', status: 'planejado' },
  { id: 'jusbrasil', name: 'Jusbrasil (licenciado)', group: 'Parceiros', status: 'planejado', note: 'Depende de contrato.' },
];

export const SOURCE_CATALOG = [...judicial, ...extrajudicial];
