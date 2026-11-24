export function parseJson<T = any>(value?: string | null, fallback: T = null as T): T {
  if (!value) return fallback;
  if (typeof value !== 'string') return value as unknown as T;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

/** Extrai o primeiro objeto JSON de um texto (respostas de IA costumam vir com texto extra). */
export function extractJson<T = any>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

/** Mantido por compatibilidade; o navegador não deixa trocar o "User-Agent". */
export const USER_AGENT = 'LexDetetive';

/** Busca JSON direto do navegador (só funciona com fontes que liberam o acesso — CORS). */
export async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<any> {
  const { timeoutMs = 20000, ...rest } = init;
  const headers: Record<string, string> = { Accept: 'application/json', ...(rest.headers as Record<string, string>) };
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e: any) {
    const err: any = new Error(e?.name === 'TimeoutError' ? `tempo esgotado em ${new URL(url).host}` : `fetch failed: ${new URL(url).host} não respondeu ou bloqueou o acesso pelo navegador`);
    err.cause = e;
    throw err;
  }
  const text = await res.text();
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status} em ${new URL(url).host}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}
