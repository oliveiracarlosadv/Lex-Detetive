'use client';
import { getSetting, setSetting } from './settings';
import { LocalError } from './db';

/** Senha de bloqueio opcional deste navegador (PBKDF2, 150 mil rodadas). */
async function derive(password: string, saltB64: string) {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150_000, hash: 'SHA-256' }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export async function hasPassword() { return !!(await getSetting('security.passwordHash')); }

export async function verifyPassword(password: string) {
  const stored = await getSetting('security.passwordHash');
  if (!stored) return true;
  const [, salt, hash] = stored.split('$');
  return (await derive(password || '', salt)) === hash;
}

/** Cria, troca ou remove (next vazio) a senha de bloqueio. */
export async function setPassword(current: string | undefined, next: string | null) {
  if ((await hasPassword()) && !(await verifyPassword(current || ''))) throw new LocalError('Senha atual incorreta.');
  if (!next) { await setSetting('security.passwordHash', null); return { hasPassword: false }; }
  if (next.length < 6) throw new LocalError('A senha precisa ter pelo menos 6 caracteres.');
  const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  await setSetting('security.passwordHash', `pbkdf2$${salt}$${await derive(next, salt)}`);
  return { hasPassword: true };
}
