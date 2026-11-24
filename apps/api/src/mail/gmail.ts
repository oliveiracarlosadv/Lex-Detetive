import { createHash, randomBytes } from 'crypto';
import { fetchJson } from '../common/json';

/** Escopos: enviar e criar rascunhos (compose) e ler a caixa "Enviados" (readonly). */
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.readonly',
  'openid',
  'email',
];

export function pkcePair() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function authUrl(p: { clientId: string; redirectUri: string; state: string; challenge: string }) {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: p.state,
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function exchangeCode(p: { clientId: string; clientSecret: string; code: string; redirectUri: string; verifier: string }) {
  return fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: p.clientId, client_secret: p.clientSecret, code: p.code,
      redirect_uri: p.redirectUri, grant_type: 'authorization_code', code_verifier: p.verifier,
    }).toString(),
  });
}

export async function refreshAccessToken(p: { clientId: string; clientSecret: string; refreshToken: string }): Promise<string> {
  const r = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: p.clientId, client_secret: p.clientSecret, refresh_token: p.refreshToken, grant_type: 'refresh_token' }).toString(),
  });
  return r.access_token;
}

export async function revoke(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => undefined);
}

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

export const gmail = {
  profile: (token: string) => fetchJson(`${API}/profile`, { headers: auth(token) }),
  send: (token: string, raw: string, threadId?: string) =>
    fetchJson(`${API}/messages/send`, { method: 'POST', headers: auth(token), body: JSON.stringify({ raw, threadId }), timeoutMs: 60000 }),
  createDraft: (token: string, raw: string) =>
    fetchJson(`${API}/drafts`, { method: 'POST', headers: auth(token), body: JSON.stringify({ message: { raw } }), timeoutMs: 60000 }),
  updateDraft: (token: string, id: string, raw: string) =>
    fetchJson(`${API}/drafts/${id}`, { method: 'PUT', headers: auth(token), body: JSON.stringify({ id, message: { raw } }), timeoutMs: 60000 }),
  deleteDraft: (token: string, id: string) =>
    fetch(`${API}/drafts/${id}`, { method: 'DELETE', headers: auth(token) }),
  /** Lista a pasta "Enviados" do próprio Gmail (cabeçalhos apenas). */
  async listSent(token: string, max = 25) {
    const list = await fetchJson(`${API}/messages?labelIds=SENT&maxResults=${max}`, { headers: auth(token) });
    const ids: { id: string; threadId: string }[] = list.messages || [];
    return Promise.all(ids.map(async (m) => {
      const d = await fetchJson(`${API}/messages/${m.id}?format=metadata&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, { headers: auth(token) });
      const h = (n: string) => d.payload?.headers?.find((x: any) => x.name.toLowerCase() === n.toLowerCase())?.value || '';
      return { id: m.id, threadId: m.threadId, to: h('To'), subject: h('Subject'), date: h('Date'), snippet: d.snippet };
    }));
  },
};
