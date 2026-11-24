'use client';
import { db } from './db';

/** Opções do app (mesmas da versão de computador, sem e-mail). Ficam no banco local do navegador. */
export const SETTING_DEFAULTS: Record<string, string> = {
  'ai.provider': 'gemini',
  'ai.model.ollama': 'qwen2.5:3b',
  'ai.model.lmstudio': 'local-model',
  'ai.model.openai': 'gpt-4.1-mini',
  'ai.model.gemini': 'gemini-2.5-flash',
  'ai.model.claude': 'claude-opus-5-5',
  'ai.model.grok': 'grok-3-mini',
  'ai.model.openrouter': 'openrouter/auto',
  'ai.baseUrl.ollama': 'http://127.0.0.1:11434',
  'ai.baseUrl.lmstudio': 'http://127.0.0.1:1234/v1',
  'ai.autoSummary': 'true',
  'privacy.maskDocuments': 'true',
  'monitor.enabled': 'true',
  'org.name': '',
  'org.city': '',
  'diarios.ufs': 'PA',
  'busca.searxngUrl': '',
  // Perfil de quem usa o app (aparece no menu e nos relatórios)
  'profile.name': '',
  'profile.photo': '',
  'profile.office': '',
  'profile.activity': '',
  'profile.registryType': '',
  'profile.registryNumber': '',
  'profile.registryUf': '',
  'profile.logo': '',
  // Bloqueio opcional por senha neste navegador
  'security.passwordHash': '',
  'app.onboarded': '',
};

/** Chaves de API: nunca aparecem em claro nas telas (só "configurada"). */
export const SECRET_PREFIXES = ['ai.key.'];
export const isSecret = (k: string) => SECRET_PREFIXES.some((p) => k.startsWith(p)) || k === 'security.passwordHash';

const cache = new Map<string, string>();

export async function getSetting(key: string): Promise<string | undefined> {
  if (cache.has(key)) return cache.get(key);
  const row = await db.settings.get(key);
  const v = row ? row.value : SETTING_DEFAULTS[key];
  if (v !== undefined) cache.set(key, v);
  return v;
}
export async function getBool(key: string) { return (await getSetting(key)) === 'true'; }

export async function setSetting(key: string, value: string | null) {
  cache.delete(key);
  if (value === null || value === '') await db.settings.delete(key);
  else await db.settings.put({ key, value });
}

/** Lista para a tela de Configurações (segredos aparecem só como "configurada"). */
export async function listPublic() {
  const rows = await db.settings.toArray();
  const out: Record<string, string | { configured: true }> = { ...SETTING_DEFAULTS };
  for (const r of rows) out[r.key] = isSecret(r.key) ? { configured: true } : r.value;
  for (const k of Object.keys(out)) if (isSecret(k) && typeof out[k] === 'string') out[k] = '';
  return out;
}

export const ALLOWED = (k: string) => k in SETTING_DEFAULTS || SECRET_PREFIXES.some((p) => k.startsWith(p)) || k.startsWith('ai.model.') || k.startsWith('ai.baseUrl.');
