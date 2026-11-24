export function parseJson<T = any>(value?: string | null, fallback: T = null as T): T {
  if (!value) return fallback;
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

/** Algumas APIs públicas bloqueiam requisições sem identificação. */
export const USER_AGENT = 'LexDetetive/0.1 (Lex Tecnologias; monitoramento juridico)';

export async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<any> {
  const { timeoutMs = 20000, ...rest } = init;
  const headers = { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(rest.headers as Record<string, string>) };
  const res = await fetch(url, { ...rest, headers, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status} em ${new URL(url).host}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}
