'use client';
import { db, audit, LocalError } from './db';
import { getSetting, setSetting, listPublic, ALLOWED, getBool } from './settings';
import { listConnectors, catalog, runConnectors } from './connectors';
import { lookupCnpj } from './connectors/brasilapi.connector';
import { isValidCnpj, isValidCpf, maskDocument, onlyDigits } from './common/documents';
import { INTERVALS, attachNumber, createTarget, getProcess, getTarget, listTargets, removeTarget, updateTarget } from './targets';
import { check, enqueue, monitorStatus } from './monitoring';
import * as clients from './clients';
import { aiModels, aiProviders, aiTest, analyzeProcess, analyzeTarget, hardware } from './ai/service';
import { buildReport, reportAuthor, REPORT_TYPES, ReportType } from './reports/report.builder';
import { exportReport, ExportFormat, FORMATS } from './reports/exporters';
import { exportBackup, importBackup, storageInfo } from './backup';
import { APP_VERSION } from './version';
import { hasPassword, setPassword, verifyPassword } from './security';

type Req = { method: string; path: string; query: URLSearchParams; body: any };
type Handler = (req: Req, params: Record<string, string>) => Promise<any>;
export interface FileResult { __file: true; blob: Blob; name: string }

const routes: [string, string, Handler][] = [];
const on = (method: string, pattern: string, h: Handler) => routes.push([method, pattern, h]);

// ---------- perfil (substitui login) ----------
async function me() {
  const [name, photo, office, activity, registryType, registryNumber, registryUf, logo] = await Promise.all(
    ['profile.name', 'profile.photo', 'profile.office', 'profile.activity', 'profile.registryType', 'profile.registryNumber', 'profile.registryUf', 'profile.logo'].map((k) => getSetting(k)));
  return { id: 'local', name: name || '', email: '', role: 'admin', totpEnabled: false, photo: photo || null, office, activity, registryType, registryNumber, registryUf, hasLogo: !!logo };
}
on('GET', 'auth/status', async () => ({ needsSetup: !(await getSetting('app.onboarded')), app: 'Lex Detetive', version: APP_VERSION }));
on('GET', 'auth/me', me);
on('GET', 'auth/lock', async () => ({ hasPassword: await hasPassword() }));
on('POST', 'auth/unlock', async ({ body }) => { if (!(await verifyPassword(body?.password || ''))) throw new LocalError('Senha incorreta.', 401); return { ok: true }; });
on('POST', 'auth/password', async ({ body }) => setPassword(body?.current, body?.next ?? null));
on('GET', 'auth/options', async () => ({ localLogin: true, googleLogin: false, passwordReset: false }));
on('PATCH', 'auth/profile', async ({ body }) => {
  for (const k of ['name', 'office', 'activity', 'registryType', 'registryNumber', 'registryUf', 'photo'] as const)
    if (body?.[k] !== undefined) await setSetting(`profile.${k}`, body[k] || null);
  return me();
});
on('GET', 'auth/profile/logo', async () => ({ dataUrl: (await getSetting('profile.logo')) || null }));
on('POST', 'auth/profile/logo', async ({ body }) => { await setSetting('profile.logo', body?.dataUrl || null); return { ok: true }; });
on('POST', 'auth/setup', async ({ body }) => {
  if (!body?.name?.trim()) throw new LocalError('Informe seu nome.');
  await setSetting('profile.name', body.name.trim());
  if (body.photo) await setSetting('profile.photo', body.photo);
  if (body.office) await setSetting('profile.office', body.office);
  await setSetting('app.onboarded', new Date().toISOString());
  return { token: 'local', user: await me() };
});

// ---------- painel e alertas ----------
on('GET', 'dashboard', async () => {
  const since30 = Date.now() - 30 * 86400000, since7 = Date.now() - 7 * 86400000;
  const [targets, processes, movements, alertsAll] = await Promise.all([db.targets.toArray(), db.processes.toArray(), db.movements.toArray(), db.alerts.toArray()]);
  const days: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) days[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = 0;
  for (const m of movements) { if (+m.date < since30) continue; const k = new Date(m.date).toISOString().slice(0, 10); if (k in days) days[k]++; }
  const byCourtMap = new Map<string, number>();
  for (const p of processes) if (p.court !== '—') byCourtMap.set(p.court, (byCourtMap.get(p.court) || 0) + 1);
  const procById = new Map(processes.map((p) => [p.id, p]));
  const tById = new Map(targets.map((t) => [t.id, t]));
  const recent = [...movements].sort((a, b) => +b.date - +a.date).slice(0, 15).map((m) => {
    const p = procById.get(m.processId); const t = p && tById.get(p.targetId);
    return { ...m, process: p ? { id: p.id, number: p.number, court: p.court, target: t ? { id: t.id, name: t.name } : null } : null };
  });
  const unread = alertsAll.filter((a) => !a.read).sort((a, b) => +b.createdAt - +a.createdAt);
  return {
    kpis: {
      pessoas: targets.filter((t) => t.kind === 'PF').length, empresas: targets.filter((t) => t.kind === 'PJ').length,
      pessoasMonitoradas: targets.filter((t) => t.kind === 'PF' && t.monitored).length, empresasMonitoradas: targets.filter((t) => t.kind === 'PJ' && t.monitored).length,
      processos: processes.length, processosAtivos: processes.filter((p) => p.status === 'ativo').length,
      movimentacoes7d: movements.filter((m) => +m.date >= since7).length, alertasNaoLidos: unread.length,
    },
    movementsByDay: Object.entries(days).map(([date, count]) => ({ date, count })),
    byCourt: [...byCourtMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([court, count]) => ({ court, count })),
    recentMovements: recent,
    alerts: unread.slice(0, 8).map((a) => ({ ...a, target: a.targetId ? { name: tById.get(a.targetId)?.name } : null })),
    queue: monitorStatus(),
  };
});
on('GET', 'alerts/unread-count', async () => ({ unread: await db.alerts.filter((a) => !a.read).count() }));
on('GET', 'alerts/parties', async ({ query }) => clients.alertParties(query.get('unread') === 'true'));
on('GET', 'alerts', async ({ query }) => {
  const unread = query.get('unread') === 'true'; const targetId = query.get('targetId');
  const limit = Math.min(300, Math.max(1, Number(query.get('limit')) || 300));
  const rows = (await db.alerts.orderBy('createdAt').reverse().filter((a) => (!unread || !a.read) && (!targetId || a.targetId === targetId)).toArray()).slice(0, limit);
  const names = new Map((await db.targets.toArray()).map((t) => [t.id, t.name]));
  return rows.map((a) => ({ ...a, target: a.targetId ? { id: a.targetId, name: names.get(a.targetId) } : null }));
});
on('POST', 'alerts/read-all', async () => ({ updated: await db.alerts.filter((a) => !a.read).modify({ read: true }) }));
on('POST', 'alerts/:id/read', async (_r, p) => { await db.alerts.update(p.id, { read: true }); return { ok: true }; });

// ---------- pesquisa e monitorados ----------
on('GET', 'cnpj/:cnpj', async (_r, p) => {
  try { return await lookupCnpj(p.cnpj); }
  catch (e: any) { throw new LocalError(e.status === 404 || e.status === 400 ? e.message : 'As APIs de CNPJ não responderam agora. Tente de novo em instantes.', e.status === 404 || e.status === 400 ? e.status : 503); }
});
on('POST', 'search', async ({ body }) => {
  if (body.cpf && !isValidCpf(body.cpf)) throw new LocalError('CPF inválido.');
  if (body.cnpj && !isValidCnpj(body.cnpj)) throw new LocalError('CNPJ inválido.');
  if (!body.name && !body.cpf && !body.cnpj && !body.processNumbers?.length) throw new LocalError('Informe nome, documento ou número de processo.');
  const results = await runConnectors(body, body.sources);
  await audit('pesquisa.executada', undefined, undefined, { kind: body.kind, name: body.name, documento: body.cpf || body.cnpj ? maskDocument(onlyDigits(body.cpf || body.cnpj)) : undefined });
  return { query: { ...body, cpf: body.cpf ? maskDocument(body.cpf) : undefined }, results };
});
on('GET', 'connectors', async () => listConnectors());
on('GET', 'sources/catalog', async () => catalog());
on('GET', 'targets/intervals', async () => INTERVALS);
on('GET', 'targets', async ({ query }) => listTargets({ kind: query.get('kind') || undefined, monitored: query.get('monitored') || undefined, q: query.get('q') || undefined }));
on('POST', 'targets', async ({ body }) => {
  const t = await createTarget(body);
  await audit('alvo.criado', 'Target', t.id, { kind: t.kind, monitored: t.monitored, finalidade: body.purpose });
  const result = await check(t.id, { initial: true });
  return { id: t.id, result };
});
on('GET', 'targets/:id', async ({ query }, p) => getTarget(p.id, query.get('reveal') === 'true'));
on('PATCH', 'targets/:id', async ({ body }, p) => { await updateTarget(p.id, body); await audit('alvo.alterado', 'Target', p.id); return getTarget(p.id); });
on('DELETE', 'targets/:id', async (_r, p) => { await removeTarget(p.id); await audit('alvo.eliminado_lgpd', 'Target', p.id); return { ok: true }; });
on('POST', 'targets/:id/check', async (_r, p) => check(p.id, { initial: false, full: true }));
on('POST', 'targets/:id/processes', async ({ body }, p) => { await attachNumber(p.id, body.number); return check(p.id, { initial: false }); });
on('GET', 'processes/:id', async (_r, p) => getProcess(p.id));
on('GET', 'processes', async ({ query }) => clients.searchProcesses(query.get('q') || ''));

// ---------- clientes ----------
on('GET', 'clients', async ({ query }) => clients.listClients(query.get('q') || undefined, query.get('status') || undefined));
on('POST', 'clients/suggest', async ({ body }) => clients.suggestClients((body?.parties || []).slice(0, 50), body?.document));
on('POST', 'clients', async ({ body }) => { const c = await clients.createClient(body); await audit('cliente.criado', 'Client', c.id); return clients.getClient(c.id); });
on('GET', 'clients/:id', async ({ query }, p) => clients.getClient(p.id, query.get('reveal') === 'true'));
on('PATCH', 'clients/:id', async ({ body }, p) => { await clients.updateClient(p.id, body); return clients.getClient(p.id); });
on('DELETE', 'clients/:id', async (_r, p) => { await clients.removeClient(p.id); await audit('cliente.eliminado_lgpd', 'Client', p.id); return { ok: true }; });
on('POST', 'clients/:id/processes', async ({ body }, p) => {
  const link = await clients.linkProcess(p.id, body);
  const proc = await db.processes.get(link.processId);
  if (proc?.source === 'manual') enqueue(proc.targetId);
  return clients.getClient(p.id);
});
on('DELETE', 'clients/:id/processes/:linkId', async (_r, p) => { await clients.unlinkProcess(p.id, p.linkId); return clients.getClient(p.id); });
on('POST', 'clients/:id/link-target', async ({ body }, p) => { await clients.linkTarget(p.id, body?.targetId); return clients.getClient(p.id); });
on('POST', 'clients/:id/link-many', async ({ body }, p) => clients.linkMany(p.id, body?.processIds || [], body?.role));
on('POST', 'clients/:id/monitor', async ({ body }, p) => {
  const existed = !!(await db.clients.get(p.id))?.targetId;
  const targetId = await clients.ensureTarget(p.id, true, body || {});
  const result = await check(targetId, { initial: !existed });
  await clients.ensureTarget(p.id, true);
  return { targetId, result };
});
on('GET', 'cep/:cep', async (_r, p) => clients.cep(p.cep));

// ---------- Lex AI ----------
on('GET', 'ai/providers', async () => aiProviders());
on('GET', 'ai/hardware', async () => hardware());
on('GET', 'ai/models', async ({ query }) => aiModels(query.get('provider') as any));
on('POST', 'ai/test', async ({ body }) => aiTest(body?.provider));
on('POST', 'ai/processes/:id/analyze', async ({ body }, p) => analyzeProcess(p.id, body?.useAi !== false));
on('POST', 'ai/targets/:id/analyze', async ({ body }, p) => analyzeTarget(p.id, body?.useAi !== false));

// ---------- sistema ----------
on('GET', 'health', async () => ({ ok: true, app: 'Lex Detetive', version: APP_VERSION, time: new Date() }));
on('GET', 'settings', async () => ({ settings: await listPublic(), dataDir: 'Este navegador (armazenamento local do site)', queue: monitorStatus() }));
on('PUT', 'settings', async ({ body }) => {
  for (const [k, v] of Object.entries(body || {})) {
    if (!ALLOWED(k)) throw new LocalError(`Configuração desconhecida: ${k}`);
    await setSetting(k, v as string | null);
  }
  await audit('configuracoes.alteradas', undefined, undefined, Object.keys(body || {}));
  return listPublic();
});
on('GET', 'audit', async ({ query }) => (await db.audit.orderBy('at').reverse().limit(Math.min(Number(query.get('limit')) || 200, 1000)).toArray())
  .map((a) => ({ id: String(a.id), createdAt: a.at, action: a.action, entity: a.entity, entityId: a.entityId, details: a.details, user: { name: 'Você' } })));
on('GET', 'backups', async () => []);
on('POST', 'backups', async () => exportBackup());
on('POST', 'backups/import', async ({ body }) => importBackup(body?.text || ''));
on('GET', 'storage', async () => storageInfo());
on('POST', 'storage/persist', async () => ({ persisted: !!(await navigator.storage?.persist?.().catch(() => false)) }));
on('POST', 'data/erase', async () => { await Promise.all(['targets', 'processes', 'movements', 'alerts', 'snapshots', 'analyses', 'clients', 'clientProcesses', 'audit'].map((t) => (db as any)[t].clear())); return { ok: true }; });
on('GET', 'reports/targets/:id', async ({ query }, p): Promise<FileResult> => {
  const type = (query.get('type') || 'sintetico') as ReportType; const format = (query.get('format') || 'pdf') as ExportFormat;
  if (!REPORT_TYPES[type]) throw new LocalError('Tipo de relatório inválido.');
  if (!FORMATS[format]) throw new LocalError('Formato inválido.');
  const target: any = await getTarget(p.id);
  for (const pr of target.processes) pr.movements = (await db.movements.where('processId').equals(pr.id).toArray()).sort((a, b) => +b.date - +a.date);
  const report = buildReport(type, JSON.parse(JSON.stringify(target)), await reportAuthor(getSetting));
  const bytes = await exportReport(report, format);
  await audit('relatorio.gerado', 'Target', p.id, { type, format, integridade: report.integrity });
  const slug = target.name.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40);
  return { __file: true, blob: new Blob([bytes as BlobPart], { type: FORMATS[format].mime }), name: `lex-detetive-${type}-${slug}-${new Date().toISOString().slice(0, 10)}.${FORMATS[format].ext}` };
});

/** Atende um pedido das telas dentro do navegador, no mesmo formato da antiga API. */
export async function handle(method: string, fullPath: string, body?: any): Promise<any> {
  const [rawPath, qs = ''] = fullPath.replace(/^\/+/, '').split('?');
  const path = rawPath.replace(/\/+$/, '');
  const parts = path.split('/');
  for (const [m, pattern, h] of routes) {
    if (m !== method.toUpperCase()) continue;
    const pp = pattern.split('/');
    if (pp.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (pp.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(parts[i])), true) : seg === parts[i]))) {
      const out = await h({ method, path, query: new URLSearchParams(qs), body }, params);
      if (out && (out as FileResult).__file) return out;
      return out === undefined ? null : JSON.parse(JSON.stringify(out));
    }
  }
  throw new LocalError('Esta função não existe na versão do navegador.', 404);
}

export { getBool };
