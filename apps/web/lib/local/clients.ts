'use client';
import { db, newId, LocalError, Client } from './db';
import { formatCnj, isValidCnj, isValidCnpj, isValidCpf, maskCnpj, maskCpf, onlyDigits, formatCpf, formatCnpj } from './common/documents';
import { fetchJson } from './common/json';
import { getBool } from './settings';
import { AUTOR, REU } from './targets/ingest';
import { parseHandles } from './connectors/social.connector';
import { attachNumber, createTarget, processView, updateTarget } from './targets';

const normName = (t?: string | null) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\b(LTDA|ME|EPP|EIRELI|S ?A|SA)\b/g, ' ').replace(/\s+/g, ' ').trim();
/** Mesmo nome (ignorando acentos, pontuação e LTDA/S.A.) ou o nome completo do cliente contido no nome da parte. */
export const nameMatches = (client: string | null | undefined, party: string) => {
  const c = normName(client), p = normName(party);
  if (!c || !p) return false;
  return c === p || (c.split(' ').length >= 2 && ` ${p} `.includes(` ${c} `));
};
const mergeHandles = (...lists: (string | null | undefined)[]) => parseHandles(lists.filter(Boolean).join(',')).join(', ');

export interface ClientInput {
  kind: 'PF' | 'PJ'; name: string; tradeName?: string; document?: string; rg?: string; stateReg?: string;
  birthDate?: string; maritalStatus?: string; profession?: string; nationality?: string;
  email?: string; email2?: string; phone?: string; whatsapp?: string; website?: string; usernames?: string;
  zip?: string; street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string;
  contactPerson?: string; responsible?: string; notes?: string; status?: string;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['autor', 'réu', 'terceiro', 'interessado', 'parte'];
const PLAIN: (keyof ClientInput)[] = ['tradeName', 'stateReg', 'maritalStatus', 'profession', 'nationality', 'email', 'email2', 'phone', 'whatsapp', 'website',
  'zip', 'street', 'number', 'complement', 'district', 'city', 'state', 'contactPerson', 'responsible', 'notes', 'status'];

async function view(c: Client, reveal = false) {
  const mask = (await getBool('privacy.maskDocuments')) && !reveal;
  const processCount = await db.clientProcesses.where('clientId').equals(c.id).count();
  return {
    ...c,
    document: c.document ? (mask ? c.documentMasked : c.kind === 'PF' ? formatCpf(c.document) : formatCnpj(c.document)) : null,
    rg: c.rg ? (mask ? '***' : c.rg) : null,
    processCount,
  };
}

function validate(input: Partial<ClientInput>, creating: boolean) {
  if (creating && !['PF', 'PJ'].includes(input.kind || '')) throw new LocalError('Tipo deve ser PF ou PJ.');
  if (creating && !input.name?.trim()) throw new LocalError('Informe o nome ou a razão social.');
  for (const k of ['email', 'email2'] as const) if (input[k] && !EMAIL.test(input[k]!.trim())) throw new LocalError(`E-mail inválido: ${input[k]}`);
  const doc = onlyDigits(input.document);
  if (doc && input.kind === 'PF' && !isValidCpf(doc)) throw new LocalError('CPF inválido.');
  if (doc && input.kind === 'PJ' && !isValidCnpj(doc)) throw new LocalError('CNPJ inválido.');
  return doc;
}

function data(input: Partial<ClientInput>, kind: string, doc: string) {
  const d: Record<string, unknown> = {};
  for (const k of PLAIN) if (input[k] !== undefined) d[k] = (input[k] as string)?.trim() || null;
  if (input.usernames !== undefined) d.usernames = parseHandles(input.usernames).join(', ') || null;
  if (input.name !== undefined) d.name = input.name.trim();
  if (input.birthDate !== undefined) d.birthDate = input.birthDate ? new Date(input.birthDate) : null;
  if (input.rg !== undefined) d.rg = input.rg?.trim() || null;
  if (input.zip) d.zip = onlyDigits(input.zip).replace(/(\d{5})(\d{3})/, '$1-$2');
  if (input.document !== undefined) { d.document = doc || null; d.documentMasked = doc ? (kind === 'PF' ? maskCpf(doc) : maskCnpj(doc)) : null; }
  return d;
}

export async function listClients(q?: string, status?: string) {
  let rows = await db.clients.orderBy('name').toArray();
  if (status) rows = rows.filter((c) => c.status === status);
  if (q) {
    const t = q.toLowerCase(); const digits = onlyDigits(q);
    rows = rows.filter((c) => [c.name, c.tradeName, c.email, c.city].some((v) => (v || '').toLowerCase().includes(t)) || ((digits.length === 11 || digits.length === 14) && c.document === digits));
  }
  return Promise.all(rows.map((c) => view(c)));
}

export async function suggestClients(parties: { name: string; role?: string }[] = [], document?: string) {
  const rows = await db.clients.toArray();
  const digits = onlyDigits(document);
  const roleOf = (r?: string) => (REU.test(r || '') ? 'réu' : AUTOR.test(r || '') ? 'autor' : 'parte');
  const out = new Map<string, { id: string; name: string; kind: string; role: string; reason: string }>();
  for (const c of rows) {
    const party = parties.filter((p) => !/advogad/i.test(p.role || '')).find((p) => nameMatches(c.name, p.name) || nameMatches(c.tradeName, p.name));
    if (party) out.set(c.id, { id: c.id, name: c.name, kind: c.kind, role: roleOf(party.role), reason: `nome igual ao da parte (${roleOf(party.role)})` });
    else if ((digits.length === 11 || digits.length === 14) && c.document === digits) out.set(c.id, { id: c.id, name: c.name, kind: c.kind, role: 'parte', reason: 'mesmo CPF/CNPJ da pesquisa' });
  }
  return [...out.values()].sort((a, b) => Number(b.role !== 'parte') - Number(a.role !== 'parte'));
}

export async function alertParties(unread: boolean) {
  const alerts = (await db.alerts.orderBy('createdAt').reverse().filter((a) => !!a.data && (!unread || !a.read)).toArray()).slice(0, 300);
  const tidy = (x: string) => x.trim().replace(/^\d+\.\s*/, '').replace(/\s*\([A-ZÁ-Ú ]+\)$/i, '').replace(/[.\s]+$/, '').trim();
  const groups = new Map<string, { name: string; polos: Set<string>; alertIds: string[]; processIds: Set<string>; numbers: Set<string> }>();
  for (const a of alerts) {
    let card: any;
    try { card = JSON.parse(a.data!); } catch { continue; }
    for (const [polo, raw] of [['autor', card?.autor], ['réu', card?.reu]] as const) {
      for (const n of String(raw || '').split(';').map(tidy)) {
        if (!n || n.length < 4 || /^não informado/i.test(n)) continue;
        const key = normName(n);
        if (!key) continue;
        const g = groups.get(key) || { name: n, polos: new Set<string>(), alertIds: [], processIds: new Set<string>(), numbers: new Set<string>() };
        g.polos.add(polo);
        if (!g.alertIds.includes(a.id)) g.alertIds.push(a.id);
        if (a.processId) g.processIds.add(a.processId); else if (card?.processo) g.numbers.add(card.processo);
        groups.set(key, g);
      }
    }
  }
  const numbers = [...new Set([...groups.values()].flatMap((g) => [...g.numbers]))];
  const byNumber = new Map((numbers.length ? await db.processes.where('number').anyOf(numbers).toArray() : []).map((p) => [p.number, p.id]));
  const clients = await db.clients.toArray();
  const out = [];
  for (const g of groups.values()) {
    for (const n of g.numbers) { const id = byNumber.get(n); if (id) g.processIds.add(id); }
    const c = clients.find((x) => nameMatches(x.name, g.name) || nameMatches(x.tradeName, g.name));
    const processIds = [...g.processIds];
    const linked = c && processIds.length ? await db.clientProcesses.where('clientId').equals(c.id).filter((l) => processIds.includes(l.processId)).count() : 0;
    out.push({ name: g.name, polo: g.polos.size > 1 ? 'ambos' : [...g.polos][0], alertIds: g.alertIds, processIds, client: c ? { id: c.id, name: c.name, kind: c.kind } : null, linked });
  }
  return out.sort((a, b) => Number(!!b.client) - Number(!!a.client) || b.alertIds.length - a.alertIds.length || a.name.localeCompare(b.name));
}

export async function linkMany(clientId: string, processIds: string[], role?: string) {
  if (!(await db.clients.get(clientId))) throw new LocalError('Cliente não encontrado.', 404);
  const r = ROLES.includes(role || '') ? role! : 'parte';
  let count = 0;
  for (const processId of [...new Set(processIds)].slice(0, 300)) {
    if (!(await db.processes.get(processId))) continue;
    if (await db.clientProcesses.where('[clientId+processId]').equals([clientId, processId]).first()) continue;
    await db.clientProcesses.add({ id: newId(), clientId, processId, role: r, createdAt: new Date() });
    count++;
  }
  return { linked: count };
}

export async function getClient(id: string, reveal = false) {
  const c = await db.clients.get(id);
  if (!c) throw new LocalError('Cliente não encontrado.', 404);
  const links = (await db.clientProcesses.where('clientId').equals(id).toArray()).sort((a, b) => +b.createdAt - +a.createdAt);
  const processes = (await Promise.all(links.map(async (l) => {
    const p = await db.processes.get(l.processId);
    if (!p) return null;
    const t = await db.targets.get(p.targetId);
    return { id: l.id, role: l.role, notes: l.notes, createdAt: l.createdAt, process: { ...(await processView(p)), target: t ? { id: t.id, name: t.name } : null } };
  }))).filter(Boolean);
  return { ...(await view(c, reveal)), processes };
}

export async function createClient(input: ClientInput) {
  const doc = validate(input, true);
  if (doc && (await db.clients.where('document').equals(doc).first())) throw new LocalError('Já existe cliente com este documento.', 409);
  const now = new Date();
  const c = { id: newId(), kind: input.kind, status: 'ativo', createdAt: now, updatedAt: now, ...(data(input, input.kind, doc) as any) } as Client;
  await db.clients.add(c);
  return c;
}

export async function updateClient(id: string, input: Partial<ClientInput>) {
  const c = await db.clients.get(id);
  if (!c) throw new LocalError('Cliente não encontrado.', 404);
  const doc = validate({ ...input, kind: c.kind }, false);
  await db.clients.update(id, { ...data(input, c.kind, doc), updatedAt: new Date() });
  if (input.usernames && c.targetId) {
    const t = await db.targets.get(c.targetId);
    if (t) await updateTarget(c.targetId, { usernames: mergeHandles(t.usernames, input.usernames) });
  }
  return db.clients.get(id);
}

export async function removeClient(id: string) {
  await db.clientProcesses.where('clientId').equals(id).delete();
  await db.clients.delete(id);
}

export async function linkProcess(clientId: string, body: { processId?: string; number?: string; targetId?: string; role?: string; notes?: string }) {
  const role = ROLES.includes(body.role || '') ? body.role! : 'parte';
  if (body.targetId && !body.processId && !body.number) {
    const procs = await db.processes.where('targetId').equals(body.targetId).toArray();
    if (!procs.length) throw new LocalError('Esta pessoa/empresa ainda não tem processos para vincular.');
    for (const p of procs) if (!(await db.clientProcesses.where('[clientId+processId]').equals([clientId, p.id]).first())) await db.clientProcesses.add({ id: newId(), clientId, processId: p.id, role, createdAt: new Date() });
    return { processId: procs[0].id, role, count: procs.length };
  }
  let processId = body.processId;
  if (!processId) {
    if (!body.number || !isValidCnj(body.number)) throw new LocalError('Número CNJ inválido.');
    const existing = await db.processes.where('number').equals(formatCnj(body.number)).first();
    if (existing) processId = existing.id;
    else processId = (await attachNumber(await ensureTarget(clientId, false), body.number)).id;
  }
  if (!(await db.processes.get(processId))) throw new LocalError('Processo não encontrado.', 404);
  const link = await db.clientProcesses.where('[clientId+processId]').equals([clientId, processId]).first();
  if (link) await db.clientProcesses.update(link.id, { role, notes: body.notes ?? link.notes });
  else await db.clientProcesses.add({ id: newId(), clientId, processId, role, notes: body.notes || null, createdAt: new Date() });
  return { processId, role };
}

export async function unlinkProcess(clientId: string, linkId: string) {
  await db.clientProcesses.where('id').equals(linkId).filter((l) => l.clientId === clientId).delete();
}

export async function linkTarget(clientId: string, targetId: string) {
  const [c, t] = await Promise.all([db.clients.get(clientId), db.targets.get(targetId)]);
  if (!c) throw new LocalError('Cliente não encontrado.', 404);
  if (!t) throw new LocalError('Pessoa/empresa monitorada não encontrada.', 404);
  const other = await db.clients.where('targetId').equals(targetId).filter((x) => x.id !== clientId).first();
  if (other) throw new LocalError(`Este monitoramento já pertence ao cliente ${other.name}.`, 409);
  await db.clients.update(clientId, { targetId, ...(!c.document && t.document ? { document: t.document, documentMasked: t.documentMasked } : {}) });
  return ensureTarget(clientId, false);
}

export async function ensureTarget(clientId: string, monitored: boolean, opts: { intervalMinutes?: number; purpose?: string; processNumbers?: string[]; oab?: string } = {}): Promise<string> {
  const c = await db.clients.get(clientId);
  if (!c) throw new LocalError('Cliente não encontrado.', 404);
  let targetId = c.targetId && (await db.targets.get(c.targetId)) ? c.targetId : null;
  if (!targetId) {
    const same = c.document ? await db.targets.where('document').equals(c.document).first() : null;
    targetId = same?.id || (await createTarget({
      kind: c.kind, name: c.name, tradeName: c.tradeName || undefined, document: c.document || undefined,
      monitored, intervalMinutes: opts.intervalMinutes || 1440, purpose: opts.purpose || 'Acompanhamento de cliente do escritório', oab: opts.oab,
      usernames: c.usernames || undefined,
    })).id;
    await db.clients.update(clientId, { targetId });
  }
  await updateTarget(targetId, {
    ...(monitored ? { monitored: true } : {}),
    ...(opts.intervalMinutes ? { intervalMinutes: opts.intervalMinutes } : {}),
    ...(opts.purpose ? { purpose: opts.purpose } : {}),
    ...(opts.oab ? { oab: opts.oab } : {}),
    ...(c.usernames ? { usernames: mergeHandles((await db.targets.get(targetId))?.usernames, c.usernames) } : {}),
  });
  for (const n of opts.processNumbers || []) if (isValidCnj(n)) await attachNumber(targetId, n);
  const procs = await db.processes.where('targetId').equals(targetId).filter((p) => p.docStatus !== 'divergente').toArray();
  for (const p of procs) if (!(await db.clientProcesses.where('[clientId+processId]').equals([clientId, p.id]).first())) await db.clientProcesses.add({ id: newId(), clientId, processId: p.id, role: 'parte', createdAt: new Date() });
  return targetId;
}

export async function searchProcesses(q: string) {
  const t = (q || '').toLowerCase(); const digits = onlyDigits(q);
  const rows = await db.processes.orderBy('updatedAt').reverse().toArray();
  const out = [];
  for (const p of rows) {
    const target = await db.targets.get(p.targetId);
    if (q && !(p.number.includes(q) || (digits.length >= 7 && onlyDigits(p.number).includes(digits)) || (p.className || '').toLowerCase().includes(t) || (target?.name || '').toLowerCase().includes(t))) continue;
    out.push({ ...(await processView(p)), target: target ? { id: target.id, name: target.name } : null });
    if (out.length >= 30) break;
  }
  return out;
}

export async function cep(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 8) throw new LocalError('CEP inválido.');
  const r = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${d}`, { timeoutMs: 10000 });
  return { zip: d.replace(/(\d{5})(\d{3})/, '$1-$2'), street: r.street, district: r.neighborhood, city: r.city, state: r.state };
}
