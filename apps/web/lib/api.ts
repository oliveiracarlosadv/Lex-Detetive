'use client';

/**
 * Ponte das telas com os dados. Na versão web (PWA) tudo roda dentro do navegador:
 * os pedidos vão para o "servidor local" (lib/local/router), que usa o banco do próprio navegador.
 */
const TOKEN_KEY = 'lex.token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* sem storage */ }
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public body?: any) { super(message); }
}

let routerPromise: Promise<typeof import('./local/router')> | null = null;
const router = () => (routerPromise ??= import('./local/router'));

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return name;
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const { handle } = await router();
  try {
    const out = await handle(init.method || 'GET', path, init.body);
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (out && out.__file) { saveFile(out.blob, out.name); return { name: out.name } as T; }
    return out as T;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(e?.message || 'Erro inesperado.', e?.status || 500, e?.body);
  }
}

/** Gera e baixa um arquivo (relatórios, backups). */
export async function download(path: string) {
  const { handle } = await router();
  try {
    const out = await handle('GET', path);
    if (!out?.__file) throw new Error('Arquivo não gerado.');
    return saveFile(out.blob, out.name);
  } catch (e: any) {
    throw new ApiError(e?.message || 'Erro ao gerar o arquivo.', e?.status || 500);
  }
}
