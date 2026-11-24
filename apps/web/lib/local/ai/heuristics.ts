/**
 * Análise por regras, usada quando nenhuma IA está disponível e como base de
 * conferência dos resultados da IA. Não substitui a leitura do advogado.
 */
export interface MovementLike { date: Date | string; description: string }
export interface ProcessLike {
  number: string; court: string; className?: string | null; status?: string | null; value?: number | null;
  filedAt?: Date | string | null; parties?: { name: string; role?: string; lawyers?: string[] }[]; organ?: string | null;
  movements: MovementLike[];
}

export interface AnalysisResult {
  resumo: string;
  partes: { nome: string; papel?: string }[];
  advogados: string[];
  juizes: string[];
  valores: { descricao: string; valor: string }[];
  datas: { data: string; evento: string }[];
  eventos: string[];
  riscos: { descricao: string; nivel: 'baixo' | 'medio' | 'alto' }[];
  oportunidades: string[];
  prescricao: string;
  prazos: { descricao: string; data?: string }[];
  parecer: string;
  observacao?: string;
}

const RULES: { re: RegExp; evento: string; risco?: { descricao: string; nivel: 'baixo' | 'medio' | 'alto' }; oportunidade?: string }[] = [
  { re: /penhora|sisbajud|bacenjud|bloqueio/i, evento: 'Constrição patrimonial (penhora/bloqueio)', risco: { descricao: 'Há constrição patrimonial registrada.', nivel: 'alto' } },
  { re: /renajud|infojud/i, evento: 'Pesquisa patrimonial (RENAJUD/INFOJUD)', risco: { descricao: 'Pesquisa de bens em andamento.', nivel: 'medio' } },
  { re: /senten[çc]a.*proced|julgado procedente/i, evento: 'Sentença de procedência', risco: { descricao: 'Sentença de procedência proferida.', nivel: 'medio' } },
  { re: /improced/i, evento: 'Sentença de improcedência', oportunidade: 'Sentença de improcedência pode favorecer a parte ré.' },
  { re: /tr[âa]nsito em julgado/i, evento: 'Trânsito em julgado' },
  { re: /cumprimento de senten/i, evento: 'Cumprimento de sentença', risco: { descricao: 'Fase de cumprimento de sentença.', nivel: 'alto' } },
  { re: /cita[çc][ãa]o|cite-se/i, evento: 'Citação' },
  { re: /audi[êe]ncia/i, evento: 'Audiência' },
  { re: /acordo|homologa/i, evento: 'Acordo/homologação', oportunidade: 'Histórico de acordo indica abertura para composição.' },
  { re: /recurso|apela[çc][ãa]o|agravo/i, evento: 'Recurso' },
  { re: /baixa|arquiv/i, evento: 'Baixa/arquivamento' },
  { re: /suspens/i, evento: 'Suspensão do processo' },
];

const fmt = (d: Date | string) => new Date(d).toLocaleDateString('pt-BR');

export function heuristicAnalysis(p: ProcessLike): AnalysisResult {
  const moves = [...p.movements].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const eventos = new Set<string>();
  const riscos: AnalysisResult['riscos'] = [];
  const oportunidades = new Set<string>();
  const datas: AnalysisResult['datas'] = [];
  for (const m of moves) {
    for (const r of RULES) {
      if (r.re.test(m.description)) {
        if (!eventos.has(r.evento)) datas.push({ data: fmt(m.date), evento: r.evento });
        eventos.add(r.evento);
        if (r.risco && !riscos.some((x) => x.descricao === r.risco!.descricao)) riscos.push(r.risco);
        if (r.oportunidade) oportunidades.add(r.oportunidade);
      }
    }
  }
  if (/execu[çc][ãa]o fiscal/i.test(p.className || '')) riscos.push({ descricao: 'Execução fiscal: risco de inscrição e constrição de bens.', nivel: 'alto' });

  const last = moves[0];
  const idleDays = last ? Math.floor((Date.now() - +new Date(last.date)) / 86400000) : null;
  let prescricao = 'Sem elementos para avaliar prescrição; verificar marcos interruptivos nos autos.';
  if (idleDays !== null && idleDays > 365 && p.status !== 'baixado') {
    prescricao = `Processo sem movimentação há ${idleDays} dias. Avaliar prescrição intercorrente (art. 921 do CPC / art. 40 da LEF), conforme a fase processual.`;
    oportunidades.add('Inércia prolongada pode permitir arguição de prescrição intercorrente.');
  }
  const valores = p.value ? [{ descricao: 'Valor da causa', valor: p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }] : [];
  const advogados = [...new Set((p.parties || []).flatMap((x) => x.lawyers || []))];
  const resumo = `${p.className || 'Processo'} nº ${p.number}, ${p.court}${p.organ ? ` (${p.organ})` : ''}, ${p.status || 'ativo'}. ` +
    `${moves.length} movimentação(ões) registrada(s)${last ? `; a última em ${fmt(last.date)}: "${last.description}"` : ''}.`;
  return {
    resumo,
    partes: (p.parties || []).map((x) => ({ nome: x.name, papel: x.role })),
    advogados,
    juizes: [],
    valores,
    datas,
    eventos: [...eventos],
    riscos,
    oportunidades: [...oportunidades],
    prescricao,
    prazos: [],
    parecer: riscos.some((r) => r.nivel === 'alto')
      ? 'Há indicadores de risco elevado. Recomenda-se análise detalhada dos autos e avaliação de medidas de defesa patrimonial.'
      : 'Não foram identificados indicadores de risco elevado nas movimentações disponíveis. Recomenda-se acompanhamento periódico.',
    observacao: 'Análise automática por regras (sem IA). Confirme sempre nos autos.',
  };
}
