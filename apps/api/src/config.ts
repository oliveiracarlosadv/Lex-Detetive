import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { randomBytes, createHmac } from 'crypto';

/** Pasta de dados local (banco, chave mestra). Fica fora do código e do Drive. */
export const DATA_DIR = process.env.LEX_DATA_DIR || join(homedir(), '.lex-detetive');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = `file:${join(DATA_DIR, 'lex.db')}`;

export const PORT = Number(process.env.PORT || 3333);
export const HOST = process.env.HOST || '127.0.0.1';

/** Chave mestra AES-256 (32 bytes), criada no primeiro uso com permissão 600. */
function loadMasterKey(): Buffer {
  if (process.env.LEX_MASTER_KEY) return Buffer.from(process.env.LEX_MASTER_KEY, 'base64');
  const file = join(DATA_DIR, 'master.key');
  if (!existsSync(file)) {
    writeFileSync(file, randomBytes(32).toString('base64'), { mode: 0o600 });
    chmodSync(file, 0o600);
  }
  return Buffer.from(readFileSync(file, 'utf8').trim(), 'base64');
}

export const MASTER_KEY = loadMasterKey();
export const JWT_SECRET = createHmac('sha256', MASTER_KEY).update('lex-detetive-jwt').digest('hex');
