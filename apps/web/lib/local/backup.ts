'use client';
import { db, LocalError } from './db';
import { APP_VERSION } from './version';

const TABLES = ['targets', 'processes', 'movements', 'alerts', 'snapshots', 'analyses', 'clients', 'clientProcesses', 'settings', 'audit'] as const;
const DATE_KEYS = new Set(['createdAt', 'updatedAt', 'date', 'lastCheckedAt', 'nextCheckAt', 'lastMovementAt', 'filedAt', 'birthDate', 'at']);

/**
 * Backup completo dos dados deste navegador num arquivo (.json).
 * É a forma de levar os dados para outro aparelho ou de guardá-los antes de limpar o navegador.
 */
export async function exportBackup() {
  const data: Record<string, any[]> = {};
  for (const t of TABLES) data[t] = await (db as any)[t].toArray();
  // Chaves de API não saem no arquivo (por segurança, cadastre de novo no outro aparelho).
  data.settings = data.settings.filter((s: any) => !s.key.startsWith('ai.key.'));
  const payload = { app: 'Lex Detetive', version: APP_VERSION, createdAt: new Date(), data };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return { __file: true as const, blob: new Blob([JSON.stringify(payload)], { type: 'application/json' }), name: `lex-detetive-backup-${stamp}.json` };
}

/** Restaura um backup: substitui todos os dados deste navegador pelos do arquivo. */
export async function importBackup(text: string) {
  let payload: any;
  try { payload = JSON.parse(text); } catch { throw new LocalError('Arquivo inválido: não é um backup do Lex Detetive.'); }
  if (payload?.app !== 'Lex Detetive' || !payload.data) throw new LocalError('Arquivo inválido: não é um backup do Lex Detetive.');
  const revive = (o: any) => { for (const k of Object.keys(o)) if (DATE_KEYS.has(k) && typeof o[k] === 'string') o[k] = new Date(o[k]); return o; };
  await db.transaction('rw', TABLES.map((t) => (db as any)[t]), async () => {
    for (const t of TABLES) {
      const keepKeys = t === 'settings' ? await db.settings.filter((s) => s.key.startsWith('ai.key.')).toArray() : [];
      await (db as any)[t].clear();
      const rows = (payload.data[t] || []).map(revive);
      if (rows.length) await (db as any)[t].bulkAdd(rows);
      if (keepKeys.length) await db.settings.bulkPut(keepKeys);
    }
  });
  return { ok: true, counts: Object.fromEntries(TABLES.map((t) => [t, (payload.data[t] || []).length])) };
}

/** Quanto o app ocupa no navegador e se os dados estão protegidos contra limpeza automática. */
export async function storageInfo() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  return { usedMb: est?.usage ? Math.round(est.usage / 1048576 * 10) / 10 : null, quotaMb: est?.quota ? Math.round(est.quota / 1048576) : null, persisted: !!persisted };
}
