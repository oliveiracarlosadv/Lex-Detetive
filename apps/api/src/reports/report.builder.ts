import { createHash } from 'crypto';
import { parseJson } from '../common/json';
import { processCard, splitParties } from '../targets/ingest';

export type ReportType = 'sintetico' | 'analitico' | 'processual' | 'due_diligence' | 'compliance' | 'investigacao';

export const REPORT_TYPES: Record<ReportType, string> = {
  sintetico: 'Relatório Sintético',
  analitico: 'Relatório Analítico',
  processual: 'Relatório Processual',
  due_diligence: 'Relatório de Due Diligence',
  compliance: 'Relatório de Compliance',
  investigacao: 'Relatório de Investigação',
};

/** widths: fração da largura da página para cada coluna (soma ≈ 1) — evita palavras partidas. */
export interface Table { columns: string[]; rows: (string | number)[][]; widths?: number[] }
/** level 1 = seção numerada (1, 2…); level 2 = subseção (1.1, 1.2…). A numeração é feita pelo exportador. */
export interface Section { heading: string; paragraphs?: string[]; bullets?: string[]; table?: Table; level?: 1 | 2 }
export interface Report {
  number: string;
  title: string;
  subtitle: string;
  type: ReportType;
  generatedAt: Date;
  generatedBy: string;
  organization: string;
  city: string;
  dateLong: string;
  sections: Section[];
  /** Assinatura: nome, linhas de qualificação (atividade, registro) e escritório. */
  signature: { place: string; name: string; details: string[]; organization: string };
  /** Logomarca do escritório (PNG/JPEG) — não vai para a exportação JSON. */
  logo?: Buffer;
  integrity: string;
  data: unknown;
}

const d = (v?: Date | string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const dt = (v?: Date | string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const money = (v?: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
/** Algumas fontes enviam classes com caixa misturada ("RECURSO ORDINáRIO"): normaliza para maiúsculas. */
export const fixCase = (s?: string | null) => {
  if (!s) return s || '';
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, '').length;
  return letters && upper / letters.length > 0.6 ? s.toLocaleUpperCase('pt-BR') : s;
};
const DOC_LABEL: Record<string, string> = { confirmado: 'confere com o cadastrado', divergente: 'DIFERENTE do cadastrado (possível homônimo)', nao_informado: 'não informado na publicação' };
const partiesOf = (p: any) => (typeof p.parties === 'string' ? parseJson<any[]>(p.parties, []) : p.parties || []);
const longDate = (v: Date) => v.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

const REGISTRY_LABELS: Record<string, string> = {
  cnpj: 'CNPJ', razaoSocial: 'Razão social', nomeFantasia: 'Nome fantasia', situacao: 'Situação cadastral',
  dataSituacao: 'Data da situação', motivoSituacao: 'Motivo da situação', abertura: 'Data de abertura', naturezaJuridica: 'Natureza jurídica',
  porte: 'Porte', capitalSocial: 'Capital social', atividadePrincipal: 'Atividade principal', atividadesSecundarias: 'Atividades secundárias',
  endereco: 'Endereço', municipio: 'Município', uf: 'UF', cep: 'CEP', telefone: 'Telefone', email: 'E-mail', simples: 'Optante pelo Simples', mei: 'MEI', matriz: 'Matriz ou filial', telefones: 'Telefones', emails: 'E-mails',
};
const labelOf = (k: string) => REGISTRY_LABELS[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const registryValue = (k: string, v: unknown) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (k === 'capitalSocial' && !isNaN(Number(v))) return money(Number(v));
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return d(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? Object.values(x).join(' — ') : String(x))).join('; ');
  return String(v);
};

const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
/** Lista de nomes curta para leitura rápida: sem repetidos e no máximo 2 nomes. */
const shortNames = (list: string) => {
  const tidy = (x: string) => x.trim().replace(/^\d+\.\s*/, '').replace(/\s*\((RECORRENTE|RECORRIDO|AGRAVANTE|AGRAVADO|APELANTE|APELADO|IMPETRANTE|IMPETRADO|EMBARGANTE|EMBARGADO)S?\)$/i, '').replace(/[.\s]+$/, '').trim();
  const names = [...new Map(list.split(';').map(tidy).filter((x) => x && !/^não informado/i.test(x)).map((x) => [norm(x), x])).values()];
  if (!names.length) return 'não informado';
  return names.length > 2 ? `${names.slice(0, 2).join('; ')} e outros (${names.length - 2})` : names.join('; ');
};
const STATUS_LABEL: Record<string, string> = { ativo: 'em tramitação', baixado: 'baixado', arquivado: 'arquivado' };

/** "Intimação publicada no DJEN (Decisão): PODER JUDICIÁRIO…" → tipo + trecho útil (pula o cabeçalho do tribunal). */
export function cleanPublication(desc: string, max = 450): { kind: string; text: string } {
  const m = /^(.{3,90}?) publicada no DJEN(?: \(([^)]+)\))?: ([\s\S]*)$/.exec(desc || '');
  let kind = '';
  let body = desc || '';
  if (m) { kind = m[2] ? `${m[1]} (${m[2]})` : m[1]; body = m[3]; }
  const start = /\b(DECIS[ÃA]O|DESPACHO|SENTEN[ÇC]A|ATO ORDINAT[ÓO]RIO|ATA DE AUDI[ÊE]NCIA|TERMO DE AUDI[ÊE]NCIA|CERTID[ÃA]O|EDITAL|AC[ÓO]RD[ÃA]O|EMENTA)\b/.exec(body.slice(60));
  if (start) body = body.slice(60 + start.index);
  else body = body.replace(/^[\s\S]{0,400}?\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\s*/, ''); // tira o cabeçalho do tribunal até o número do processo
  body = body.replace(/\s+/g, ' ').trim();
  if (body.length > max) body = `${body.slice(0, max).replace(/\s+\S*$/, '').replace(/[.,;:\s]+$/, '')}…`;
  return { kind, text: body };
}

/** Resumo objetivo do processo, para leitura rápida. */
export function processSummary(p: any, targetName: string) {
  const parties = partiesOf(p);
  const sp = splitParties(parties);
  const moves: any[] = [...(p.movements || [])].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const card = processCard({ ...p, parties: JSON.stringify(parties) }, moves);
  const who = norm(targetName);
  const inAutor = !!who && norm(sp.autor).includes(who);
  const inReu = !!who && norm(sp.reu).includes(who);
  const position = inAutor && !inReu ? 'autor (polo ativo)' : inReu && !inAutor ? 'réu (polo passivo)' : inAutor && inReu ? 'aparece nos dois polos' : 'não identificada nas partes informadas';
  const djen = moves.filter((m) => String(m.code || '').startsWith('DJEN-'));
  const last = moves[0];
  const lastKind = last ? (cleanPublication(last.description).kind || cleanPublication(last.description, 90).text) : '';
  const now = Date.now();
  const nextHearing = card.audienciasMarcadas.map((a) => a.data).filter((x) => +new Date(x) > now).sort()[0];
  const marcos = (Object.entries(card.marcos) as [string, any][])
    .filter(([, v]) => v.presente)
    .map(([k, v]) => `${({ contestacao: 'contestação', replica: 'réplica', sentenca: 'sentença', liminar: 'liminar/tutela' } as any)[k]} (${d(v.data)})`);
  const classe = fixCase(p.className) || 'Processo';
  const local = [p.organ, p.court].filter(Boolean).join(', ');
  const sentence = [
    (() => {
      const a = shortNames(sp.autor), r = shortNames(sp.reu);
      const who = a !== 'não informado' && r !== 'não informado' ? `${a} contra ${r}` : a !== 'não informado' ? `ajuizado por ${a} (parte contrária não informada pela fonte)` : r !== 'não informado' ? `contra ${r} (autor não informado pela fonte)` : 'partes não informadas pela fonte';
      return `${classe}${local ? `, ${local}` : ''}: ${who}.`;
    })(),
    `O investigado figura como ${position}.`,
    `Situação: ${STATUS_LABEL[p.status] || p.status}${last ? `; último ato em ${d(last.date)}${lastKind ? ` — ${lastKind}` : ''}` : ''}.`,
    nextHearing ? `Há audiência designada para ${dt(nextHearing)}.` : '',
    p.docStatus === 'divergente' ? 'Atenção: o CPF/CNPJ da publicação é diferente do cadastrado (possível homônimo).' : '',
  ].filter(Boolean).join(' ');
  const facts: (string | number)[][] = [
    ['Classe', classe],
    ['Tribunal / órgão', local || 'não informado'],
    ['Autor', shortNames(sp.autor)],
    ['Réu', shortNames(sp.reu)],
    ['Posição do investigado', position],
    ['Situação', STATUS_LABEL[p.status] || p.status],
    ...(p.value != null ? [['Valor da causa', money(p.value)]] : []),
    ['Último ato', last ? `${d(last.date)}${lastKind ? ` — ${lastKind}` : ''}` : 'nenhuma movimentação registrada'],
    ...(djen.length ? [['Publicações no DJEN', `${djen.length} (de ${d(djen[djen.length - 1].date)} a ${d(djen[0].date)})`]] : []),
    ...(nextHearing ? [['Próxima audiência', dt(nextHearing)]] : []),
    ...(marcos.length ? [['Marcos identificados', `${marcos.join('; ')} — conferir nos autos`]] : []),
    ['CPF/CNPJ na publicação', `${DOC_LABEL[p.docStatus as string] || DOC_LABEL.nao_informado}${p.docFound ? ` (${p.docFound})` : ''}`],
  ];
  return { sentence, facts };
}

const SOURCE_NAMES: Record<string, string> = {
  datajud: 'CNJ — DataJud (metadados e movimentações processuais)',
  djen: 'CNJ — Diário de Justiça Eletrônico Nacional (DJEN)',
  'receita-cnpj': 'Receita Federal — Cadastro Nacional da Pessoa Jurídica',
  transparencia: 'CGU — Portal da Transparência (CEIS/CNEP)',
  dou: 'Imprensa Nacional — Diário Oficial da União',
  'querido-diario': 'Diários Oficiais Municipais (Querido Diário)',
  doe: 'Diários Oficiais dos Estados',
  'redes-sociais': 'Redes sociais e perfis públicos',
  buscadores: 'Buscadores na internet (Brave, SearXNG, Google, Bing, DuckDuckGo, Yandex)',
};

/** Monta o relatório no padrão de documento forense; cada exportador só desenha. */
export interface ReportAuthor { user: string; organization: string; city?: string; activity?: string | null; registry?: string | null; logo?: string | null }

export function buildReport(type: ReportType, target: any, opts: ReportAuthor): Report {
  const generatedAt = new Date();
  const title = REPORT_TYPES[type];
  const processes: any[] = target.processes || [];
  const real = processes.filter((p) => p.source !== 'manual');
  const registry = target.registry;
  const analysis = target.analyses?.[0]?.result;
  const records = (target.snapshots || []).filter((s: any) => s.source !== 'receita-cnpj' && Array.isArray(s.data));
  const latest = new Map<string, any[]>();
  for (const s of records) if (!latest.has(s.source)) latest.set(s.source, s.data);
  const sancoes = latest.get('transparencia') || [];
  const dou = latest.get('dou') || [];
  const municipais = latest.get('querido-diario') || [];
  const doeAll = latest.get('doe') || [];
  const estaduais = doeAll.filter((r: any) => !/— abrir busca/.test(r.title));
  const estaduaisLinks = doeAll.filter((r: any) => /— abrir busca/.test(r.title));
  // Publicações do Diário de Justiça (DJEN), gravadas como movimentações dos processos.
  const djen = real.flatMap((p) => (p.movements || [])
    .filter((m: any) => String(m.code || '').startsWith('DJEN-'))
    .map((m: any) => ({ date: m.date, process: p, text: m.description as string })))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const totalDiarios = djen.length + dou.length + municipais.length + estaduais.length;
  const social = latest.get('redes-sociais') || [];
  const web = latest.get('buscadores') || [];
  const ativos = real.filter((p) => p.status === 'ativo').length;
  const valor = real.reduce((s, p) => s + (p.value || 0), 0);
  const kindLabel = target.kind === 'PF' ? 'pessoa física' : 'pessoa jurídica';
  const sections: Section[] = [];

  sections.push({
    heading: 'Apresentação',
    paragraphs: [
      `${title} de ${target.name} (${kindLabel}), elaborado em ${d(generatedAt)} às ${generatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} por ${opts.user}, com base exclusivamente em fontes públicas oficiais.`,
      `Finalidade (LGPD): ${target.purpose || 'não informada pelo solicitante'}.`,
    ],
  });

  sections.push({
    heading: 'Identificação do investigado',
    table: {
      columns: ['Campo', 'Informação'],
      rows: [
        ['Natureza', target.kind === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'],
        [target.kind === 'PF' ? 'Nome' : 'Razão social', target.name],
        ...(target.tradeName ? [['Nome fantasia', target.tradeName]] : []),
        [target.kind === 'PF' ? 'CPF' : 'CNPJ', target.document || 'não informado'],
        ...(target.motherName ? [['Filiação (mãe)', target.motherName]] : []),
        ...(target.fatherName ? [['Filiação (pai)', target.fatherName]] : []),
        ...(target.oab ? [['OAB', target.oab]] : []),
        ...(target.usernames ? [['Redes sociais (usuários)', target.usernames]] : []),
        ['Monitoramento', target.monitored ? `ativo, verificação a cada ${target.intervalMinutes} minuto(s)` : 'inativo'],
      ] as (string | number)[][],
      widths: [0.3, 0.7],
    },
  });

  const sources = (target.lastCheck?.sources || []).filter((s: any) => !s.skipped && SOURCE_NAMES[s.id]);
  sections.push({
    heading: 'Metodologia e fontes consultadas',
    paragraphs: [
      'Consulta automatizada às fontes públicas abaixo, com registro de data e hora, sem alteração manual dos dados. A integridade do documento pode ser conferida pelo código SHA-256 do rodapé.',
    ],
    table: sources.length ? {
      columns: ['Fonte', 'Situação', 'Resultado', 'Consulta'],
      widths: [0.4, 0.16, 0.26, 0.18],
      rows: sources.map((s: any) => [
        SOURCE_NAMES[s.id], s.ok ? 'consultada' : 'indisponível',
        s.ok ? [s.processes ? `${s.processes} processo(s)` : '', s.records ? `${s.records} ${s.id === 'transparencia' ? 'sanção(ões)' : ['dou', 'querido-diario'].includes(s.id) ? 'publicação(ões)' : 'registro(s)'}` : ''].filter(Boolean).join('; ') || 'nada encontrado' : 'fora do ar no momento',
        dt(target.lastCheck?.at).replace(', ', '\n'),
      ]),
    } : undefined,
  });

  if (registry && ['analitico', 'due_diligence', 'compliance', 'investigacao'].includes(type)) {
    sections.push({
      heading: 'Dados cadastrais (Receita Federal)',
      table: { columns: ['Campo', 'Informação'], widths: [0.3, 0.7], rows: Object.entries(registry).filter(([k]) => k !== 'socios').map(([k, v]) => [labelOf(k), registryValue(k, v)]) },
    });
    if (registry.socios?.length)
      sections.push({ heading: 'Quadro de sócios e administradores', level: 2, table: { columns: ['Nome', 'Qualificação', 'Entrada'], widths: [0.45, 0.35, 0.2], rows: registry.socios.map((s: any) => [s.nome, s.qualificacao || '—', d(s.entrada)]) } });
  }

  sections.push({
    heading: 'Processos judiciais localizados',
    paragraphs: [
      real.length
        ? `Foram localizados ${real.length} processo(s), sendo ${ativos} em tramitação e ${real.length - ativos} baixado(s) ou arquivado(s), ` +
          `nos seguintes órgãos: ${[...new Set(real.map((p) => p.court))].join(', ')}. A soma dos valores das causas informados é de ${money(valor)}.`
        : 'Resultado: 0 (zero) processos encontrados nas fontes consultadas. Tal resultado não equivale a certidão negativa: podem existir processos que tramitam em segredo de justiça (sigilo), os quais não são exibidos em consultas públicas.',
    ],
    table: real.length ? {
      columns: ['Processo', 'Classe', 'Partes', 'Situação'],
      widths: [0.32, 0.2, 0.34, 0.14],
      rows: real.map((p) => {
        const sp = splitParties(partiesOf(p));
        return [
          `${p.number}\n${p.court}`,
          fixCase(p.className) || '—',
          `Autor: ${shortNames(sp.autor)}\nRéu: ${shortNames(sp.reu)}${p.docStatus === 'divergente' ? '\nCPF/CNPJ diferente (possível homônimo)' : ''}`,
          STATUS_LABEL[p.status] || p.status,
        ];
      }),
    } : undefined,
  });

  // Um bloco por processo: resumo objetivo + (nos relatórios detalhados) as movimentações.
  const perProcess = type === 'sintetico' ? 0 : type === 'processual' || type === 'investigacao' ? 1000 : 5;
  if (real.length) sections.push({ heading: 'Resumo de cada processo', paragraphs: ['Leitura rápida de cada processo localizado. Os dados vêm das publicações e devem ser conferidos nos autos.'] });
  for (const p of real) {
    const sum = processSummary(p, target.name);
    sections.push({ heading: `Processo nº ${p.number}`, level: 2, table: { columns: ['Ponto', 'Informação'], widths: [0.28, 0.72], rows: [['Em resumo', sum.sentence], ...sum.facts] } });
    const moves = (p.movements || []).slice(0, perProcess);
    if (moves.length) sections.push({
      heading: `Movimentações do processo nº ${p.number}`, level: 2,
      paragraphs: (p.movements || []).length > moves.length ? [`Exibidas as ${moves.length} mais recentes de ${(p.movements || []).length}.`] : undefined,
      table: {
        columns: ['Data', 'Ato', 'Trecho'], widths: [0.14, 0.2, 0.66],
        rows: moves.map((m: any) => { const c = cleanPublication(m.description); return [d(m.date), c.kind || 'Movimentação', c.text]; }),
      },
    });
  }

  // ---------------- Diários oficiais (em todos os tipos de relatório) ----------------
  {
    const brief = type === 'sintetico';
    const max = brief ? 20 : 200;
    const cut = (t: string) => { const n = brief ? 300 : 700; return t.length > n ? `${t.slice(0, n)}…` : t; };
    const status = (id: string) => (target.lastCheck?.sources || []).find((s: any) => s.id === id);
    const none = (id: string, label: string) => {
      const st = status(id);
      if (st && !st.ok && !st.skipped) return `A fonte ${label} estava fora do ar na última consulta; recomenda-se nova verificação.`;
      if (!st || st.skipped) return `A fonte ${label} não foi consultada nesta pesquisa.`;
      return `Resultado: 0 (zero) publicações encontradas no ${label}.`;
    };
    const more = (n: number) => (n > max ? [`Exibidas as ${max} publicações mais recentes de um total de ${n}.`] : []);
    sections.push({
      heading: 'Publicações em diários oficiais',
      paragraphs: [
        totalDiarios
          ? `Foram localizadas ${totalDiarios} publicação(ões) em diários oficiais: ${djen.length} no Diário de Justiça Eletrônico Nacional (DJEN), ${dou.length} no Diário Oficial da União, ${estaduais.length} em diários oficiais estaduais e ${municipais.length} em diários oficiais municipais.`
          : 'Não foram localizadas publicações em diários oficiais nas fontes consultadas.',
        'Por se tratar de busca textual pelo nome, as publicações estão sujeitas a homônimos e devem ser conferidas no documento original.',
      ],
    });
    sections.push({
      heading: 'Diário de Justiça Eletrônico Nacional (DJEN)', level: 2,
      paragraphs: djen.length
        ? [`${djen.length} intimação(ões), citação(ões) ou edital(is) publicados pelos tribunais.`, ...more(djen.length)]
        : [none('djen', 'Diário de Justiça Eletrônico Nacional (DJEN)')],
      table: djen.length ? {
        columns: ['Data', 'Processo', 'Publicação'],
        widths: [0.14, 0.33, 0.53],
        rows: djen.slice(0, max).map((x) => {
          const c = cleanPublication(x.text, brief ? 220 : 400);
          return [
            d(x.date),
            `${x.process.number}\n${x.process.court}${x.process.docStatus === 'divergente' ? '\nCPF diferente (possível homônimo)' : ''}`,
            c.kind ? `${c.kind}\n${c.text}` : c.text,
          ];
        }),
      } : undefined,
    });
    const gazette = (id: string, heading: string, label: string, list: any[]) => sections.push({
      heading, level: 2,
      paragraphs: list.length ? [`${list.length} publicação(ões) localizada(s).`, ...more(list.length)] : [none(id, label)],
      table: list.length ? {
        columns: ['Data', 'Publicação', 'Trecho'],
        widths: [0.14, 0.3, 0.56],
        rows: list.slice(0, max).map((r: any) => [d(r.date), r.title, cut(r.detail || '')]),
      } : undefined,
    });
    gazette('dou', 'Diário Oficial da União (DOU)', 'Diário Oficial da União', dou);
    gazette('doe', 'Diários Oficiais dos Estados', 'conjunto de Diários Oficiais dos Estados', estaduais.map((r: any) => ({ ...r, title: r.title.replace(/^Diário Oficial do Estado — /, 'DOE-') })));
    if (!estaduais.length && estaduaisLinks.length && !brief) sections.push({
      heading: 'Buscas prontas nos Diários Oficiais dos Estados', level: 2,
      paragraphs: ['Não há busca nacional dos diários estaduais; sem buscador automático configurado, as buscas abaixo (dentro do site de cada diário) devem ser abertas pelo profissional.'],
      table: { columns: ['Estado', 'Busca'], widths: [0.3, 0.7], rows: estaduaisLinks.map((r: any) => { const m = /Diário Oficial do (.+?) por (.+)$/.exec(r.title); return [m?.[1] || '', m?.[2] || r.title]; }) },
    });
    gazette('querido-diario', 'Diários oficiais municipais', 'Querido Diário (diários oficiais municipais)', municipais);
  }

  // ---------------- Redes sociais ----------------
  if (type !== 'processual') {
    const consulted = (target.lastCheck?.sources || []).some((s: any) => s.id === 'redes-sociais' && s.ok);
    const found = social.filter((r: any) => /encontrado$/.test(r.title));
    const same = social.filter((r: any) => /mesmo nome/.test(r.title));
    const posts = social.filter((r: any) => /cita/.test(r.title));
    const manual = social.filter((r: any) => /conferir manualmente/.test(r.title));
    const brief = type === 'sintetico';
    const site = (title: string) => title.split(' — ')[0];
    sections.push({
      heading: 'Redes sociais e perfis públicos',
      paragraphs: [
        !consulted ? 'A busca em redes sociais não foi realizada nesta pesquisa.'
          : `Nomes de usuário pesquisados: ${target.usernames || 'nenhum informado'}. Resultado: ${found.length} perfil(is) confirmado(s), ${same.length} conta(s) com o mesmo nome e ${posts.length} publicação(ões) pública(s) citando o nome.`,
        ...(consulted ? ['“Perfil confirmado” significa que o nome de usuário existe na rede, não que pertença ao investigado. Perfis, contas e publicações localizados podem ser de homônimos ou de terceiros; a titularidade deve ser confirmada antes de qualquer uso.'] : []),
      ],
    });
    if (found.length) sections.push({ heading: 'Perfis confirmados', level: 2, table: { columns: ['Rede', 'Perfil', 'Informações públicas'], widths: [0.18, 0.37, 0.45], rows: found.map((r: any) => [site(r.title), r.url || '', [r.detail, r.date ? `criado em ${d(r.date)}` : ''].filter(Boolean).join('\n')]) } });
    if (same.length) sections.push({ heading: 'Contas com o mesmo nome', level: 2, table: { columns: ['Rede', 'Conta', 'Informações'], widths: [0.18, 0.37, 0.45], rows: same.map((r: any) => [site(r.title), r.url || '', r.detail || '']) } });
    if (posts.length) sections.push({ heading: 'Publicações que citam o nome', level: 2, table: { columns: ['Data', 'Onde', 'Trecho'], widths: [0.14, 0.3, 0.56], rows: posts.slice(0, brief ? 10 : 40).map((r: any) => [d(r.date), r.title.replace(/ — .*@/, ' — @').replace(/ citando o nome$/, '').replace(/ — página que cita o nome:.*/, ''), (r.detail || '').slice(0, brief ? 200 : 400)]) } });
    if (manual.length && !brief) sections.push({ heading: 'Redes para conferência manual', level: 2, paragraphs: ['Estas redes só exibem perfis a usuários logados; os endereços abaixo devem ser abertos pelo profissional para confirmar a existência e a titularidade.'], table: { columns: ['Rede', 'Endereço'], widths: [0.25, 0.75], rows: manual.map((r: any) => [site(r.title), r.url || '']) } });
  }

  // ---------------- Buscadores na internet ----------------
  if (type !== 'processual') {
    const consulted = (target.lastCheck?.sources || []).some((s: any) => s.id === 'buscadores' && s.ok);
    const pages = web.filter((r: any) => !/— abrir busca por/.test(r.title));
    const links = web.filter((r: any) => /— abrir busca por/.test(r.title));
    const cited = pages.filter((r: any) => r.severity === 'atencao');
    const brief = type === 'sintetico';
    sections.push({
      heading: 'Buscadores na internet',
      paragraphs: !consulted ? ['A busca em buscadores da internet não foi realizada nesta pesquisa.'] : [
        pages.length
          ? `Foram localizadas ${pages.length} página(s) pela busca do nome completo e do documento do investigado${cited.length ? `, das quais ${cited.length} citam o próprio CPF/CNPJ` : ''}.`
          : 'A busca automática não retornou páginas (ou não está configurada). As buscas prontas abaixo podem ser abertas para conferência.',
        'Resultados obtidos pelo nome estão sujeitos a homônimos; a pertinência de cada página deve ser conferida no endereço original.',
      ],
      table: pages.length ? {
        columns: ['Página', 'Trecho'], widths: [0.34, 0.66],
        rows: pages.slice(0, brief ? 10 : 40).map((r: any) => [r.title.replace(/ — /, '\n'), (r.detail || '').slice(0, brief ? 200 : 400)]),
      } : undefined,
    });
    if (links.length && !brief) sections.push({
      heading: 'Buscas prontas para conferência', level: 2,
      paragraphs: ['As APIs oficiais do Google e do Bing não estão disponíveis para consulta automática e o DuckDuckGo bloqueia consultas automatizadas; as buscas abaixo devem ser abertas pelo profissional.'],
      table: { columns: ['Buscador', 'Busca'], widths: [0.2, 0.8], rows: links.map((r: any) => [r.title.split(' — ')[0], r.title.replace(/^.*— abrir busca por /, '')]) },
    });
  }

  if (['due_diligence', 'compliance', 'investigacao', 'analitico'].includes(type)) {
    sections.push({
      heading: 'Sanções administrativas (CEIS/CNEP)',
      paragraphs: [sancoes.length ? `Foram localizadas ${sancoes.length} sanção(ões) administrativa(s):` : 'Não foram localizadas sanções nos cadastros CEIS/CNEP, ou a fonte não foi consultada (requer chave de acesso do Portal da Transparência).'],
      table: sancoes.length ? { columns: ['Data', 'Sanção', 'Detalhes'], widths: [0.14, 0.3, 0.56], rows: sancoes.map((r: any) => [d(r.date), r.title, r.detail || '']) } : undefined,
    });
  }

  if (type === 'investigacao') {
    const timeline = real.flatMap((p) => (p.movements || []).map((m: any) => ({ date: m.date, number: p.number, text: m.description as string })))
      .sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 60);
    if (timeline.length) sections.push({ heading: 'Linha do tempo consolidada', table: { columns: ['Data', 'Processo', 'Evento'], widths: [0.14, 0.3, 0.56], rows: timeline.map((t) => { const c = cleanPublication(t.text, 200); return [d(t.date), t.number, c.kind || c.text]; }) } });
    const changes = (target.snapshots || []).filter((s: any) => s.changes && s.source === 'receita-cnpj');
    if (changes.length) sections.push({ heading: 'Histórico de alterações cadastrais', level: 2, bullets: changes.map((s: any) => `${d(s.createdAt)}: ${(s.changes as any[]).map((c) => c.field).join(', ')}`) });
  }

  if (analysis && type !== 'sintetico') {
    sections.push({ heading: 'Análise técnica', paragraphs: [analysis.resumo, 'Análise elaborada com auxílio de inteligência artificial e sujeita à conferência do profissional responsável.'].filter(Boolean) });
    if (analysis.riscos?.length) sections.push({ heading: 'Riscos identificados', level: 2, bullets: analysis.riscos.map((r: any) => `Risco ${r.nivel}: ${r.descricao}`) });
    if (analysis.oportunidades?.length) sections.push({ heading: 'Oportunidades', level: 2, bullets: analysis.oportunidades });
    if (analysis.prescricao) sections.push({ heading: 'Prescrição', level: 2, paragraphs: [analysis.prescricao] });
  }

  sections.push({
    heading: 'Conclusão',
    paragraphs: [
      analysis?.parecer ||
      (real.length
        ? `Do levantamento realizado, constatou-se a existência de ${real.length} processo(s) relacionado(s) a ${target.name}, dos quais ${ativos} em tramitação${sancoes.length ? `, além de ${sancoes.length} sanção(ões) administrativa(s)` : ''}${totalDiarios ? `, e ${totalDiarios} publicação(ões) em diários oficiais` : ''}. Recomenda-se a análise individualizada dos autos e a manutenção do monitoramento.`
        : `Do levantamento realizado, foram encontrados 0 (zero) processos relacionados a ${target.name} nas fontes públicas consultadas${totalDiarios ? `, e ${totalDiarios} publicação(ões) em diários oficiais` : ''}. Podem existir processos em segredo de justiça (sigilo), ressalvadas as limitações abaixo.`),
    ],
  });

  sections.push({
    heading: 'Limitações e ressalvas',
    bullets: [
      'As informações refletem o conteúdo das fontes públicas na data e hora da consulta e podem estar incompletas ou desatualizadas.',
      'A ausência de registros não equivale a certidão negativa. Processos em segredo de justiça não são exibidos em consultas públicas.',
      'A busca por nome está sujeita a homônimos; a vinculação de cada registro ao investigado deve ser confirmada nos autos.',
      'Este documento contém dados pessoais tratados nos termos da LGPD e destina-se exclusivamente à finalidade declarada. É vedada a sua divulgação a terceiros não autorizados.',
    ],
  });

  const city = opts.city || '';
  const integrity = createHash('sha256').update(JSON.stringify({ sections, generatedAt })).digest('hex');
  const number = `LD-${generatedAt.getFullYear()}-${integrity.slice(0, 8).toUpperCase()}`;
  sections.push({
    heading: 'Encerramento',
    paragraphs: [
      `Nada mais havendo a relatar, encerra-se o presente ${title.toLowerCase()}, nº ${number}, que vai assinado pelo responsável.`,
    ],
    table: { columns: ['Código de integridade (SHA-256)'], widths: [1], rows: [[integrity]] },
  });

  const report: Report = {
    number, title, subtitle: target.name, type, generatedAt, generatedBy: opts.user, organization: opts.organization, city,
    dateLong: `${city ? `${city}, ` : ''}${longDate(generatedAt)}`,
    sections, integrity,
    signature: { place: city, name: opts.user, details: [opts.activity, opts.registry].filter(Boolean) as string[], organization: opts.organization },
    data: { target: { ...target, analyses: undefined }, type },
  };
  const m = opts.logo && /^data:image\/(png|jpeg);base64,(.+)$/.exec(opts.logo);
  if (m) Object.defineProperty(report, 'logo', { value: Buffer.from(m[2], 'base64'), enumerable: false });
  return report;
}

/** Dados de autoria do relatório a partir do perfil do usuário e das configurações. */
export async function reportAuthor(prisma: any, settings: any, userId: string, fallbackName: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  const registry = u?.registryType && u?.registryNumber ? `${u.registryType}${u.registryUf ? `/${u.registryUf}` : ''} ${u.registryNumber}` : null;
  return {
    user: u?.name || fallbackName,
    organization: u?.office || (await settings.get('org.name')) || 'Lex Tecnologias',
    city: await settings.get('org.city'),
    activity: u?.activity || null,
    registry,
    logo: u?.logo || null,
  };
}

export { parseJson };
