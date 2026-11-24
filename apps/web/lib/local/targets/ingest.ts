import { sha256Hex } from '../common/hash';
import { formatCnj } from '../common/documents';
import { parseJson } from '../common/json';
import { ConnectorResult, FoundRecord } from '../connectors/types';

export const movementFingerprint = (date: string, description: string) =>
  sha256Hex(`${new Date(date).toISOString()}|${description.trim().toLowerCase()}`);

/** Diferenças entre dois snapshots cadastrais (campo a campo). */
export function diffRegistry(before: Record<string, unknown> | null, after: Record<string, unknown>) {
  if (!before) return [];
  // Só campos que já existiam e voltaram preenchidos: um campo novo (outra API) ou uma API fora do ar
  // não é "alteração cadastral".
  const keys = Object.keys(after).filter((k) => k in before && after[k] != null && after[k] !== '');
  const changes: { field: string; before: unknown; after: unknown }[] = [];
  for (const k of keys) {
    if (JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) changes.push({ field: k, before: before[k] ?? null, after: after[k] ?? null });
  }
  return changes;
}

export const recordKey = (r: FoundRecord) => `${r.title}|${r.date || ''}|${r.url || ''}`;

/** Achados (sanções, publicações) que não estavam no snapshot anterior. */
export function newRecords(previous: FoundRecord[] | null, current: FoundRecord[]) {
  // Snapshots antigos podem guardar outro formato (objeto); só listas entram na comparação.
  const seen = new Set((Array.isArray(previous) ? previous : []).map(recordKey));
  return current.filter((r) => !seen.has(recordKey(r)));
}

export function summarizeResults(results: ConnectorResult[]) {
  return results.map((r) => ({
    id: r.connectorId, name: r.connectorName, ok: r.ok, skipped: !!r.skipped, message: r.message,
    processes: r.processes.length, records: r.records?.length || 0, durationMs: r.durationMs,
  }));
}

export const normalizeNumber = (n: string) => formatCnj(n);
export { parseJson };

/** Intimações, citações e notificações exigem atenção imediata (prazos). */
export const INTIMACAO = /intima[çc]|cita[çc][ãa]o|cite-se|notifica[çc]|mandado de|prazo/i;

export const AUTOR = /autor|requerente|exequente|reclamante|impetrante|embargante|apelante|agravante|ativo/i;
export const REU = /r[ée]u|requerid|executad|reclamad|impetrad|embargad|apelad|agravad|passivo/i;

/** Separa os nomes do polo ativo (autor) e passivo (réu) a partir dos papéis informados pelas fontes. */
export function splitParties(parties: { name: string; role?: string }[] | null | undefined) {
  const list = (parties || []).filter((x) => !/advogad/i.test(x.role || ''));
  const names = (re: RegExp) => list.filter((x) => re.test(x.role || '')).map((x) => x.name).join('; ');
  return { autor: names(AUTOR) || 'não informado pela fonte', reu: names(REU) || 'não informado pela fonte' };
}

export interface Marco { presente: boolean; data?: string; descricao?: string }
export interface Audiencia { data: string; descricao: string; registradaEm: string }

export interface ProcessCard {
  processo: string; tribunal: string; vara: string; autor: string; reu: string; valorCausa: string;
  classe?: string;
  /** Movimentações novas que geraram o alerta. */
  movimentos: { data: string; descricao: string; intimacao: boolean }[];
  ultimasMovimentacoes: { data: string; descricao: string }[];
  audienciasMarcadas: Audiencia[];
  audienciasRealizadas: Audiencia[];
  marcos: { contestacao: Marco; replica: Marco; sentenca: Marco; liminar: Marco };
  intimacao: boolean;
  resumoIA?: string;
  resumoFonte?: string;
}

const MARCOS = {
  contestacao: /contesta[çc][ãa]o/i,
  replica: /r[ée]plica|impugna[çc][ãa]o [àa] contesta/i,
  sentenca: /senten[çc]a|julgad[oa] (procedente|improcedente|parcialmente)|extin[çc][ãa]o do processo|homologa[çc][ãa]o de acordo/i,
  liminar: /liminar|tutela (de urg[êe]ncia|antecipada|provis[óo]ria|cautelar)/i,
};
const AUD_MARCADA = /audi[êe]ncia.*(designada|marcada|redesignada|agendada|pautada)|designa[çc][ãa]o de audi[êe]ncia/i;
const AUD_REALIZADA = /audi[êe]ncia.*(realizada|conclu[íi]da|encerrada)|termo de audi[êe]ncia|ata de audi[êe]ncia/i;
const DATA_BR = /(\d{2})\/(\d{2})\/(\d{4})(?:\D{1,6}(\d{1,2})[:h](\d{2}))?/;

/** Usa a data citada no texto ("designada para 10/12/2026 14:00") ou a data da movimentação. */
function hearingDate(m: { date: string | Date; description: string }): string {
  const x = m.description.match(DATA_BR);
  if (x) return new Date(Number(x[3]), Number(x[2]) - 1, Number(x[1]), Number(x[4] || 0), Number(x[5] || 0)).toISOString();
  return new Date(m.date).toISOString();
}

/**
 * Ficha resumida do processo exibida nos alertas e na tela do processo.
 * `all` = todas as movimentações conhecidas; `fresh` = as que acabaram de chegar.
 */
export function processCard(
  p: { number: string; court: string; organ?: string | null; className?: string | null; value?: number | null; parties?: string | null },
  all: { date: string | Date; description: string }[],
  fresh: { date: string | Date; description: string }[] = [],
): ProcessCard {
  const parties = parseJson<{ name: string; role?: string }[]>(p.parties, []) || [];
  const names = (re: RegExp) => parties.filter((x) => re.test(x.role || '')).map((x) => x.name).join('; ');
  const unknown = 'não informado pela fonte';
  const sorted = [...all].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const iso = (d: string | Date) => new Date(d).toISOString();
  const marco = (re: RegExp): Marco => {
    const m = sorted.find((x) => re.test(x.description));
    return m ? { presente: true, data: iso(m.date), descricao: m.description } : { presente: false };
  };
  const movimentos = fresh.map((m) => ({ data: iso(m.date), descricao: m.description, intimacao: INTIMACAO.test(m.description) }));
  return {
    processo: p.number,
    tribunal: p.court,
    vara: p.organ || unknown,
    autor: names(AUTOR) || unknown,
    reu: names(REU) || unknown,
    valorCausa: p.value != null ? p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : unknown,
    classe: p.className || undefined,
    movimentos,
    ultimasMovimentacoes: sorted.slice(0, 5).map((m) => ({ data: iso(m.date), descricao: m.description })),
    audienciasMarcadas: sorted.filter((m) => AUD_MARCADA.test(m.description)).map((m) => ({ data: hearingDate(m), descricao: m.description, registradaEm: iso(m.date) })),
    audienciasRealizadas: sorted.filter((m) => AUD_REALIZADA.test(m.description)).map((m) => ({ data: iso(m.date), descricao: m.description, registradaEm: iso(m.date) })),
    marcos: { contestacao: marco(MARCOS.contestacao), replica: marco(MARCOS.replica), sentenca: marco(MARCOS.sentenca), liminar: marco(MARCOS.liminar) },
    intimacao: movimentos.some((m) => m.intimacao),
  };
}
