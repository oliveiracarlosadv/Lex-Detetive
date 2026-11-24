'use client';
import { db } from './db';
import { runConnectors } from './connectors';
import { buildQuery, ingest, IngestSummary } from './targets';
import { summarizeResults } from './targets/ingest';
import { getBool } from './settings';

/**
 * Verificação automática dentro do navegador: roda enquanto o app estiver aberto
 * (em qualquer aba ou instalado como aplicativo). Uma pessoa/empresa por vez.
 */
const queue: string[] = [];
const running = new Set<string>();
let summarizer: ((ids: string[]) => void) | null = null;
export const setSummarizer = (fn: (ids: string[]) => void) => { summarizer = fn; };

export const monitorStatus = () => ({ queued: queue.length, running: running.size, summaries: 0 });

export async function check(id: string, opts: { initial: boolean; full?: boolean }): Promise<IngestSummary & { sources: ReturnType<typeof summarizeResults> }> {
  const target = await db.targets.get(id);
  if (!target) return { newProcesses: 0, newMovements: 0, alerts: 0, registryChanges: 0, newRecords: 0, intimacoes: 0, summarize: [], sources: [] };
  const query = await buildQuery(id);
  if (!opts.initial && !opts.full && target.lastCheckedAt) query.incremental = true;
  const results = await runConnectors(query, undefined, { background: !opts.initial && !opts.full });
  const summary = await ingest(id, results, opts);
  const sources = summarizeResults(results);
  if (summary.summarize.length) summarizer?.(summary.summarize);
  const now = new Date();
  await db.targets.update(id, {
    lastCheckedAt: now,
    nextCheckAt: target.monitored ? new Date(now.getTime() + target.intervalMinutes * 60_000) : null,
    lastCheck: { at: now, summary, sources },
  });
  window.dispatchEvent(new CustomEvent('lex:dados-atualizados'));
  return { ...summary, sources };
}

export function enqueue(id: string) {
  if (running.has(id) || queue.includes(id)) return;
  queue.push(id);
  drain();
}

function drain() {
  while (running.size < 1 && queue.length) {
    const id = queue.shift()!;
    running.add(id);
    check(id, { initial: false })
      .catch((e) => console.warn('Falha ao verificar', id, e?.message))
      .finally(() => { running.delete(id); setTimeout(drain, 8000); });
  }
}

let started = false;
/** Liga o relógio do monitoramento (uma vez por aba). Só uma aba verifica por vez. */
export function startMonitoring() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const tick = async () => {
    if (!(await getBool('monitor.enabled'))) return;
    // Evita duas abas verificando ao mesmo tempo.
    const lock = Number(localStorage.getItem('lex.monitor.lock') || 0);
    if (lock > Date.now()) return;
    localStorage.setItem('lex.monitor.lock', String(Date.now() + 25_000));
    const now = new Date();
    const due = (await db.targets.filter((t) => t.monitored && (!t.nextCheckAt || new Date(t.nextCheckAt) <= now)).toArray())
      .sort((a, b) => +new Date(a.nextCheckAt || 0) - +new Date(b.nextCheckAt || 0)).slice(0, 20);
    due.forEach((t) => enqueue(t.id));
  };
  setTimeout(tick, 20_000); // a tela abre primeiro
  setInterval(tick, 30_000);
}
