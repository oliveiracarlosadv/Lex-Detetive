import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { MASTER_KEY } from '../config';

/** Criptografia AES-256-GCM. Formato: v1:<iv>:<tag>:<dados> (base64). */
export function encrypt(plain: string, key: Buffer = MASTER_KEY): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64'))).join(':');
}

export function decrypt(payload: string, key: Buffer = MASTER_KEY): string {
  const [version, iv, tag, data] = payload.split(':');
  if (version !== 'v1') throw new Error('Formato de criptografia desconhecido');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

export const encryptOpt = (v?: string | null) => (v ? encrypt(v) : null);
export const decryptOpt = (v?: string | null) => (v ? decrypt(v) : null);

/** Hash determinístico (HMAC-SHA256) para localizar documentos sem guardá-los em claro. */
export function blindIndex(value: string, key: Buffer = MASTER_KEY): string {
  return createHmac('sha256', key).update(value).digest('hex');
}
