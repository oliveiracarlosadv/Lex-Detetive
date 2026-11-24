'use client';
import { db, newId, LocalError, Target, Process } from './db';
import { formatCnj, isValidCnj, isValidCnpj, isValidCpf, maskCnpj, maskCpf, onlyDigits, formatCpf, formatCnpj } from './common/documents';
import { ConnectorResult, FoundRecord, SearchQuery } from './connectors/types';
import { getBool } from './settings';
import { DOC_RANK, DocStatus, mergeChecks } from './common/doc-match';
import { diffRegistry, movementFingerprint, newRecords, processCard } from './targets/ingest';
import { parseHandles } from './connectors/social.connector';

export const INTERVALS = [1, 5, 15, 30, 60, 360, 1440];

export interface TargetInput {
  kind: 'PF' | 'PJ'; name: string; document?: string; tradeName?: string; rg?: string; motherName?: string; fatherName?: string;
  partners?: string[]; notes?: string; purpose?: string; oab?: string; usernames?: string; monitored?: boolean; intervalMinutes?: number; processNumbers?: string[];
}
export interface IngestSummary { newProcesses: number; newMovements: number; alerts: number; registryChanges: number; newRecords: number; intimacoes: number; summarize: string[] }

/** Movimentação "nova de verdade": dos últimos 15 dias ou posterior à última já conhecida do processo. */
export function isRecentMovement(date: string | Date, lastKnown: Date | null | undefined, now = Date.now()) {
  const t = new Date(date).getTime();
  if (t >= now - 15 * 86_400_000) return true;
  return !!lastKnown && t > new Date(lastKnown).getTime() - 86_400_000;
}

const docMask = (kind: string, d: string) => (kind === 'PF' ? maskCpf(d) : maskCnpj(d));
const docFormat = (kind: string, d: string) => (kind === 'PF' ? formatCpf(d) : formatCnpj(d));

// ---------- leitura ----------
export async function targetView(t: Target, reveal = false) {
  const mask = (await getBool('privacy.maskDocuments')) && !reveal;
  const [processes, alerts] = await Promise.all([
    db.processes.where('targetId').equals(t.id).count(),
    db.alerts.where('targetId').equals(t.id).filter((a) => !a.read).count(),
  ]);
  return {
    id: t.id, kind: t.kind, name: t.name, tradeName: t.tradeName,
    document: t.document ? (mask ? t.documentMasked : docFormat(t.kind, t.document)) : null,
    documentMasked: t.documentMasked,
    rg: t.rg ? (mask ? '***' : t.rg) : null,
    motherName: t.motherName, fatherName: t.fatherName, partners: t.partners || [],
    notes: t.notes, purpose: t.purpose, oab: t.oab, usernames: t.usernames,
    monitored: t.monitored, intervalMinutes: t.intervalMinutes,
    lastCheckedAt: t.lastCheckedAt, nextCheckAt: t.nextCheckAt, lastCheck: t.lastCheck || null, registry: t.registry || null,
    createdAt: t.createdAt, updatedAt: t.updatedAt, counts: { processes, alerts },
  };
}

export async function listTargets(filter: { kind?: string; monitored?: string; q?: string }) {
  let rows = await db.targets.orderBy('updatedAt').reverse().toArray();
  if (filter.kind) rows = rows.filter((t) => t.kind === filter.kind);
  if (filter.monitored === 'true') rows = rows.filter((t) => t.monitored);
  if (filter.q) {
    const q = filter.q.toLowerCase(); const digits = onlyDigits(filter.q);
    rows = rows.filter((t) => t.name.toLowerCase().includes(q) || (t.tradeName || '').toLowerCase().includes(q) || ((digits.length === 11 || digits.length === 14) && t.document === digits));
  }
  return Promise.all(rows.map((t) => targetView(t)));
}

export async function processView(p: Process) {
  const movementsCount = await db.movements.where('processId').equals(p.id).count();
  return { ...p, movementsCount };
}

export async function getTarget(id: string, reveal = false) {
  const t = await db.targets.get(id);
  if (!t) throw new LocalError('Pessoa/empresa não encontrada.', 404);
  const processes = (await db.processes.where('targetId').equals(id).toArray())
    .sort((a, b) => +new Date(b.lastMovementAt || 0) - +new Date(a.lastMovementAt || 0));
  const snapshots = (await db.snapshots.where('targetId').equals(id).toArray()).sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 50);
  const analyses = (await db.analyses.where('targetId').equals(id).filter((a) => !a.processId).toArray()).sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 5);
  const views = await Promise.all(processes.map(processView));
  return {
    ...(await targetView(t, reveal)),
    processes: views.sort((a, b) => (DOC_RANK[a.docStatus as DocStatus] ?? 1) - (DOC_RANK[b.docStatus as DocStatus] ?? 1)),
    docSummary: {
      confirmado: processes.filter((p) => p.docStatus === 'confirmado').length,
      nao_informado: processes.filter((p) => p.docStatus === 'nao_informado').length,
      divergente: processes.filter((p) => p.docStatus === 'divergente').length,
    },
    snapshots, analyses,
  };
}

export async function getProcess(id: string) {
  const p = await db.processes.get(id);
  if (!p) throw new LocalError('Processo não encontrado.', 404);
  const movements = (await db.movements.where('processId').equals(id).toArray()).sort((a, b) => +b.date - +a.date);
  const target = await db.targets.get(p.targetId);
  const analyses = (await db.analyses.where('processId').equals(id).toArray()).sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 5);
  const links = await db.clientProcesses.where('processId').equals(id).toArray();
  const clients = (await Promise.all(links.map(async (l) => { const c = await db.clients.get(l.clientId); return c ? { id: c.id, name: c.name, role: l.role } : null; }))).filter(Boolean);
  return {
    ...p, movementsCount: movements.length, movements,
    target: target ? { id: target.id, name: target.name, kind: target.kind } : null,
    card: processCard({ ...p, parties: JSON.stringify(p.parties) } as any, movements),
    clients, analyses,
  };
}

// ---------- escrita ----------
function normalize(input: TargetInput) {
  if (!['PF', 'PJ'].includes(input.kind)) throw new LocalError('Tipo deve ser PF ou PJ.');
  if (!input.name?.trim() && !input.document) throw new LocalError('Informe ao menos o nome ou o documento.');
  const doc = onlyDigits(input.document);
  if (doc) {
    if (input.kind === 'PF' && !isValidCpf(doc)) throw new LocalError('CPF inválido.');
    if (input.kind === 'PJ' && !isValidCnpj(doc)) throw new LocalError('CNPJ inválido.');
  }
  if (input.intervalMinutes && !INTERVALS.includes(input.intervalMinutes)) throw new LocalError('Intervalo de monitoramento inválido.');
  if (input.oab && !/^\s*\d{1,7}\s*\/\s*[A-Za-z]{2}\s*$/.test(input.oab)) throw new LocalError('OAB deve estar no formato 12345/UF.');
  const numbers = (input.processNumbers || []).map((n) => n.trim()).filter(Boolean);
  for (const n of numbers) if (!isValidCnj(n)) throw new LocalError(`Número de processo inválido: ${n}`);
  return { doc, numbers };
}

export async function createTarget(input: TargetInput) {
  const { doc, numbers } = normalize(input);
  if (doc) {
    const existing = await db.targets.where('document').equals(doc).first();
    if (existing) throw new LocalError('Este documento já está cadastrado.', 409, { message: 'Este documento já está cadastrado.', id: existing.id });
  }
  const now = new Date();
  const t: Target = {
    id: newId(), kind: input.kind,
    name: (input.name || '').trim() || docFormat(input.kind, doc),
    tradeName: input.tradeName?.trim() || null,
    document: doc || null, documentMasked: doc ? docMask(input.kind, doc) : null,
    rg: input.rg?.trim() || null, motherName: input.motherName?.trim() || null, fatherName: input.fatherName?.trim() || null,
    partners: input.partners || [], notes: input.notes || null, purpose: input.purpose || null,
    oab: input.oab?.trim() || null, usernames: parseHandles(input.usernames).join(', ') || null,
    monitored: !!input.monitored, intervalMinutes: input.intervalMinutes || 1440,
    nextCheckAt: input.monitored ? now : null, createdAt: now, updatedAt: now,
  };
  await db.targets.add(t);
  for (const n of numbers) await attachNumber(t.id, n);
  return t;
}

export async function updateTarget(id: string, input: Partial<TargetInput>) {
  const t = await db.targets.get(id);
  if (!t) throw new LocalError('Pessoa/empresa não encontrada.', 404);
  if (input.intervalMinutes && !INTERVALS.includes(input.intervalMinutes)) throw new LocalError('Intervalo inválido.');
  const monitored = input.monitored ?? t.monitored;
  const patch: Partial<Target> = {};
  const doc = onlyDigits(input.document);
  if (doc) {
    if (t.kind === 'PF' ? !isValidCpf(doc) : !isValidCnpj(doc)) throw new LocalError(t.kind === 'PF' ? 'CPF inválido.' : 'CNPJ inválido.');
    const other = await db.targets.where('document').equals(doc).filter((x) => x.id !== id).first();
    if (other) throw new LocalError('Este documento já está em outro monitoramento.', 409, { message: 'Este documento já está em outro monitoramento.', id: other.id });
    Object.assign(patch, { document: doc, documentMasked: docMask(t.kind, doc) });
  }
  if (input.name?.trim()) patch.name = input.name.trim();
  for (const k of ['tradeName', 'motherName', 'fatherName', 'notes', 'purpose'] as const) if (input[k] !== undefined) (patch as any)[k] = input[k];
  if (input.oab !== undefined) patch.oab = input.oab.trim() || null;
  if (input.usernames !== undefined) patch.usernames = parseHandles(input.usernames).join(', ') || null;
  if (input.partners) patch.partners = input.partners;
  if (input.intervalMinutes) patch.intervalMinutes = input.intervalMinutes;
  patch.monitored = monitored;
  patch.nextCheckAt = monitored ? (input.monitored && !t.monitored ? new Date() : t.nextCheckAt ?? new Date()) : null;
  patch.updatedAt = new Date();
  await db.targets.update(id, patch);
  return { ...t, ...patch };
}

/** LGPD: eliminação definitiva dos dados da pessoa/empresa e de tudo que foi coletado. */
export async function removeTarget(id: string) {
  await db.transaction('rw', [db.targets, db.processes, db.movements, db.alerts, db.snapshots, db.analyses, db.clients, db.clientProcesses], async () => {
    const procIds = await db.processes.where('targetId').equals(id).primaryKeys();
    await db.movements.where('processId').anyOf(procIds).delete();
    await db.clientProcesses.where('processId').anyOf(procIds).delete();
    await db.analyses.where('processId').anyOf(procIds).delete();
    await db.processes.where('targetId').equals(id).delete();
    await db.alerts.where('targetId').equals(id).delete();
    await db.snapshots.where('targetId').equals(id).delete();
    await db.analyses.where('targetId').equals(id).delete();
    await db.clients.where('targetId').equals(id).modify({ targetId: null });
    await db.targets.delete(id);
  });
}

export async function attachNumber(targetId: string, number: string) {
  if (!isValidCnj(number)) throw new LocalError('Número CNJ inválido.');
  const formatted = formatCnj(number);
  const existing = await db.processes.where('[targetId+number]').equals([targetId, formatted]).first();
  if (existing) return existing;
  const now = new Date();
  const p: Process = { id: newId(), targetId, number: formatted, court: '—', source: 'manual', className: 'Aguardando consulta', status: 'ativo', parties: [], docStatus: 'nao_informado', createdAt: now, updatedAt: now };
  await db.processes.add(p);
  return p;
}

export async function buildQuery(id: string): Promise<SearchQuery> {
  const t = await db.targets.get(id);
  if (!t) throw new LocalError('Pessoa/empresa não encontrada.', 404);
  const procs = await db.processes.where('targetId').equals(id).toArray();
  return {
    kind: t.kind, name: t.name, tradeName: t.tradeName || undefined,
    cpf: t.kind === 'PF' ? t.document || undefined : undefined, cnpj: t.kind === 'PJ' ? t.document || undefined : undefined,
    motherName: t.motherName || undefined, fatherName: t.fatherName || undefined, partners: t.partners || [],
    oab: t.oab || undefined, usernames: parseHandles(t.usernames),
    processNumbers: procs.map((p) => p.number), courts: [...new Set(procs.map((p) => p.court))],
  };
}

// ---------- consolidação dos resultados ----------
export async function ingest(targetId: string, results: ConnectorResult[], opts: { initial: boolean }): Promise<IngestSummary> {
  const summary: IngestSummary = { newProcesses: 0, newMovements: 0, alerts: 0, registryChanges: 0, newRecords: 0, intimacoes: 0, summarize: [] };
  const target = await db.targets.get(targetId);
  if (!target) return summary;
  const byProcess = new Map<string, { id: string; type: string }>();
  const alert = async (data: { type: string; title: string; message: string; severity?: string; processId?: string; data?: string }) => {
    const prev = data.processId && ['intimacao', 'movimentacao'].includes(data.type) ? byProcess.get(data.processId) : undefined;
    if (prev) {
      const keep = prev.type === 'intimacao' && data.type !== 'intimacao';
      await db.alerts.update(prev.id, keep ? { data: data.data } : { ...data, severity: data.severity || 'info', read: false });
      const updated = (await db.alerts.get(prev.id))!;
      byProcess.set(data.processId!, { id: updated.id, type: updated.type });
      return updated;
    }
    summary.alerts++;
    const created = { id: newId(), targetId, processId: data.processId || null, type: data.type, severity: data.severity || 'info', title: data.title, message: data.message, data: data.data || null, read: false, createdAt: new Date() };
    await db.alerts.add(created);
    if (data.processId && ['intimacao', 'movimentacao'].includes(data.type)) byProcess.set(data.processId, { id: created.id, type: created.type });
    return created;
  };

  for (const r of results) {
    if (!r.ok || r.skipped) continue;

    for (const fp of r.processes) {
      const number = formatCnj(fp.number);
      const existing = await db.processes.where('[targetId+number]').equals([targetId, number]).first();
      const lastMovementAt = fp.movements[0] ? new Date(fp.movements[0].date) : null;
      const prevParties = existing?.parties || [];
      const mergedParties = [...prevParties, ...(fp.parties || []).filter((p) => !prevParties.some((x) => x.name === p.name))];
      const data: Partial<Process> = {
        court: fp.court || existing?.court || '—',
        parties: mergedParties,
        status: fp.status || existing?.status || 'ativo',
        source: existing && existing.source !== 'manual' && existing.source !== r.connectorId ? `${existing.source}+${r.connectorId}`.split('+').filter((v, i, a) => a.indexOf(v) === i).join('+') : r.connectorId,
      };
      if (fp.system) data.system = fp.system;
      if (fp.className) data.className = fp.className;
      if (fp.organ) data.organ = fp.organ;
      if (fp.degree) data.degree = fp.degree;
      if (fp.subjects?.length) data.subjects = fp.subjects;
      if (fp.value != null) data.value = fp.value;
      if (fp.filedAt) data.filedAt = new Date(fp.filedAt);
      if (fp.docCheck) {
        const prev = existing ? { status: existing.docStatus as DocStatus, found: existing.docFound || undefined } : undefined;
        const merged = mergeChecks(prev && prev.status !== 'nao_informado' ? prev : undefined, fp.docCheck);
        data.docStatus = merged.status;
        data.docFound = merged.found || null;
      }
      const homonym = (data.docStatus ?? existing?.docStatus) === 'divergente';
      const homonymNote = homonym ? ' — CPF diferente do cadastrado (possível homônimo)' : '';
      let processId: string;
      const isNew = !existing || existing.source === 'manual';
      const now = new Date();
      if (!existing) {
        processId = newId();
        await db.processes.add({ id: processId, targetId, number, docStatus: 'nao_informado', createdAt: now, updatedAt: now, lastMovementAt, ...(data as any) });
        summary.newProcesses++;
        if (!opts.initial) {
          const card = processCard({ ...(data as any), parties: JSON.stringify(mergedParties), number }, fp.movements, fp.movements.slice(0, 3));
          const a = await alert({ type: 'novo_processo', severity: homonym ? 'info' : 'atencao', processId, title: `Novo processo: ${number}${homonymNote}`, message: `${fp.className || 'Processo'} no ${fp.court}.`, data: JSON.stringify(card) });
          summary.summarize.push(a.id);
        }
      } else {
        processId = existing.id;
        const keepLast = lastMovementAt && (!existing.lastMovementAt || lastMovementAt > new Date(existing.lastMovementAt)) ? lastMovementAt : existing.lastMovementAt;
        await db.processes.update(processId, { ...data, lastMovementAt: keepLast, updatedAt: now });
        if (existing.source !== 'manual' && existing.status === 'ativo' && fp.status && fp.status !== 'ativo')
          await alert({ type: 'baixa', severity: 'atencao', processId, title: `Processo baixado: ${number}`, message: fp.movements[0]?.description || 'Baixa registrada.' });
      }

      if (!homonym) await linkToClients(targetId, processId, mergedParties);

      const known = new Set((await db.movements.where('processId').equals(processId).toArray()).map((m) => m.fingerprint));
      const fresh: typeof fp.movements = [];
      for (const m of fp.movements) {
        const fingerprint = movementFingerprint(m.date, m.fingerprintText ?? m.description);
        if (known.has(fingerprint)) continue;
        known.add(fingerprint);
        try {
          await db.movements.add({ id: newId(), processId, date: new Date(m.date), code: m.code || null, description: m.description, fingerprint, createdAt: now });
          fresh.push(m);
        } catch { /* gravada por verificação simultânea */ }
      }
      summary.newMovements += fresh.length;
      const alertable = fresh.filter((m) => isRecentMovement(m.date, existing?.lastMovementAt ?? null));
      if (alertable.length && !isNew && !opts.initial) {
        const all = await db.movements.where('processId').equals(processId).toArray();
        const card = processCard({ ...(data as any), parties: JSON.stringify(mergedParties), value: data.value ?? existing?.value, organ: data.organ ?? existing?.organ, className: data.className ?? existing?.className, number }, all, alertable);
        if (card.intimacao) summary.intimacoes++;
        const a = await alert({
          type: card.intimacao ? 'intimacao' : 'movimentacao', processId,
          severity: homonym ? 'info' : card.intimacao ? 'critico' : 'info',
          title: (card.intimacao ? `Intimação/citação — ${number}` : `${alertable.length} nova(s) movimentação(ões) — ${number}`) + homonymNote,
          message: alertable[0].description, data: JSON.stringify(card),
        });
        summary.summarize.push(a.id);
      }
    }

    if (r.registry) {
      const before = (await db.targets.get(targetId))?.registry || null;
      const changes = diffRegistry(before as any, r.registry);
      if (!before || changes.length) {
        await db.snapshots.add({ id: newId(), targetId, source: r.connectorId, data: r.registry, changes: changes.length ? changes : null, createdAt: new Date() });
        await db.targets.update(targetId, { registry: r.registry });
      }
      if (changes.length) {
        summary.registryChanges += changes.length;
        await alert({ type: 'alteracao_cadastral', severity: 'atencao', title: `Alteração cadastral (${changes.length} campo(s))`, message: changes.map((c) => c.field).join(', ') });
      }
    }

    if (r.records) {
      const last = (await db.snapshots.where('targetId').equals(targetId).filter((s) => s.source === r.connectorId).toArray()).sort((a, b) => +b.createdAt - +a.createdAt)[0];
      const fresh = newRecords(Array.isArray(last?.data) ? last!.data : null, r.records);
      if (!last || fresh.length) await db.snapshots.add({ id: newId(), targetId, source: r.connectorId, data: r.records, changes: fresh.length ? fresh : null, createdAt: new Date() });
      summary.newRecords += fresh.length;
      for (const rec of fresh as FoundRecord[]) {
        const noisy = (['buscadores', 'redes-sociais', 'doe', 'dou', 'transparencia'].includes(r.connectorId) || /— abrir (busca|consulta)/.test(rec.title)) && rec.severity !== 'atencao';
        if (rec.severity === 'critico' || (!opts.initial && last && !noisy))
          await alert({ type: rec.severity === 'critico' ? 'sancao' : 'publicacao', severity: rec.severity || 'info', title: rec.title, message: rec.detail?.slice(0, 300) || '' });
      }
    }
  }

  if (opts.initial) {
    await alert({ type: 'pesquisa_inicial', title: `Pesquisa inicial concluída — ${target.name}`, message: `${summary.newProcesses} processo(s), ${summary.newMovements} movimentação(ões) e ${summary.newRecords} outro(s) achado(s).` });
  }
  summary.summarize = [...new Set(summary.summarize)];
  return summary;
}

/** Rotina do cliente: todo processo encontrado no monitoramento de um cliente é vinculado a ele. */
async function linkToClients(targetId: string, processId: string, parties: { name: string; role?: string }[]) {
  const clients = await db.clients.where('targetId').equals(targetId).toArray();
  for (const c of clients) {
    const words = c.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const mine = parties.find((p) => { const n = p.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return words.length && words.every((w) => n.includes(w)); });
    const role = mine?.role ? (/ativo|autor|requerente|reclamante|exequente/i.test(mine.role) ? 'autor' : /passivo|r[ée]u|requerid|reclamad|executad/i.test(mine.role) ? 'réu' : 'parte') : 'parte';
    const exists = await db.clientProcesses.where('[clientId+processId]').equals([c.id, processId]).first();
    if (!exists) await db.clientProcesses.add({ id: newId(), clientId: c.id, processId, role, createdAt: new Date() });
  }
}
