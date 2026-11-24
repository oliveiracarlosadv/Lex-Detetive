'use client';
import Dexie, { type Table } from 'dexie';

/**
 * Banco de dados local do Lex Detetive, dentro do navegador (IndexedDB).
 * Os dados ficam só neste aparelho/navegador e permanecem até que os dados do site sejam apagados.
 */
export interface Target {
  id: string; kind: 'PF' | 'PJ'; name: string; tradeName?: string | null;
  document?: string | null; documentMasked?: string | null; rg?: string | null;
  motherName?: string | null; fatherName?: string | null; partners?: string[]; notes?: string | null; purpose?: string | null;
  oab?: string | null; usernames?: string | null;
  monitored: boolean; intervalMinutes: number; lastCheckedAt?: Date | null; nextCheckAt?: Date | null;
  lastCheck?: any; registry?: Record<string, any> | null; createdAt: Date; updatedAt: Date;
}
export interface Process {
  id: string; targetId: string; number: string; court: string; system?: string | null; className?: string | null;
  subjects?: string[]; organ?: string | null; degree?: string | null; status: string; value?: number | null;
  parties: { name: string; role?: string; lawyers?: string[] }[]; filedAt?: Date | null; lastMovementAt?: Date | null;
  docStatus: string; docFound?: string | null; source: string; createdAt: Date; updatedAt: Date;
}
export interface Movement { id: string; processId: string; date: Date; code?: string | null; description: string; fingerprint: string; createdAt: Date }
export interface Alert {
  id: string; targetId?: string | null; processId?: string | null; type: string; severity: string; title: string; message: string;
  data?: string | null; read: boolean; createdAt: Date;
}
export interface Snapshot { id: string; targetId: string; source: string; data: any; changes?: any; createdAt: Date }
export interface Analysis { id: string; targetId?: string | null; processId?: string | null; provider: string; model: string; result: any; createdAt: Date }
export interface Client {
  id: string; kind: 'PF' | 'PJ'; name: string; tradeName?: string | null; document?: string | null; documentMasked?: string | null; rg?: string | null;
  stateReg?: string | null; birthDate?: Date | null; maritalStatus?: string | null; profession?: string | null; nationality?: string | null;
  email?: string | null; email2?: string | null; phone?: string | null; whatsapp?: string | null; website?: string | null; usernames?: string | null;
  zip?: string | null; street?: string | null; number?: string | null; complement?: string | null; district?: string | null; city?: string | null; state?: string | null;
  contactPerson?: string | null; responsible?: string | null; notes?: string | null; status: string; targetId?: string | null; createdAt: Date; updatedAt: Date;
}
export interface ClientProcess { id: string; clientId: string; processId: string; role: string; notes?: string | null; createdAt: Date }
export interface Setting { key: string; value: string }
export interface AuditEntry { id?: number; at: Date; action: string; entity?: string; entityId?: string; details?: any }

class LexDB extends Dexie {
  targets!: Table<Target, string>;
  processes!: Table<Process, string>;
  movements!: Table<Movement, string>;
  alerts!: Table<Alert, string>;
  snapshots!: Table<Snapshot, string>;
  analyses!: Table<Analysis, string>;
  clients!: Table<Client, string>;
  clientProcesses!: Table<ClientProcess, string>;
  settings!: Table<Setting, string>;
  audit!: Table<AuditEntry, number>;

  constructor() {
    super('lex-detetive');
    this.version(1).stores({
      targets: 'id, kind, name, document, monitored, nextCheckAt, updatedAt',
      processes: 'id, targetId, number, &[targetId+number], status, court, lastMovementAt, updatedAt',
      movements: 'id, processId, date, &[processId+fingerprint], createdAt',
      alerts: 'id, targetId, processId, read, createdAt',
      snapshots: 'id, targetId, source, createdAt',
      analyses: 'id, targetId, processId, createdAt',
      clients: 'id, name, document, targetId',
      clientProcesses: 'id, clientId, processId, &[clientId+processId]',
      settings: 'key',
      audit: '++id, at',
    });
  }
}

export const db = new LexDB();
export const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

/** Erro com código HTTP (as telas mostram a mensagem como faziam com o servidor). */
export class LocalError extends Error {
  constructor(message: string, public status = 400, public body?: any) { super(message); }
}

export async function audit(action: string, entity?: string, entityId?: string, details?: any) {
  try { await db.audit.add({ at: new Date(), action, entity, entityId, details }); } catch { /* auditoria não bloqueia */ }
}
