import { fetchJson } from '../common/json';
import { Connector, FoundRecord } from './types';

/**
 * Redes sociais e perfis públicos (OSINT passivo).
 * - Por nome de usuário: confirma perfis só nas redes que respondem de forma confiável sem login;
 *   nas demais (Instagram, Facebook, TikTok, LinkedIn…) gera o link para conferência manual.
 * - Por nome: contas com o mesmo nome (Bluesky, GitHub) e publicações que citam o nome (Bluesky e,
 *   na versão do navegador, só redes que liberam a consulta direta).
 * Não testa cadastro por e-mail em sites de terceiros (isso usaria telas de login/recuperação de senha).
 */
const TIMEOUT = 12000;

/** "@fulano", "instagram.com/fulano", "https://x.com/fulano?x=1" → "fulano". */
export function cleanHandle(raw: string): string {
  let h = (raw || '').trim();
  // Tira o endereço do site ("https://www.instagram.com/", "x.com/@", "bsky.app/profile/").
  h = h.replace(/^(https?:\/\/)?(www\.|m\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|me|app|social|tv|ee|ly|io|br|co)\/((profile|in|user|people|channel)\/)?(@)?/i, '');
  h = h.replace(/^@/, '').split(/[/?#\s]/)[0];
  return /^[A-Za-z0-9._-]{2,40}$/.test(h) ? h : '';
}

export function parseHandles(list?: string[] | string | null): string[] {
  const arr = Array.isArray(list) ? list : (list || '').split(/[\n,;]+/);
  return [...new Set(arr.map(cleanHandle).filter(Boolean).map((h) => h.toLowerCase()))].slice(0, 5);
}

type Check = (h: string) => Promise<{ found: boolean; detail?: string; date?: string } | null>;


interface Site { name: string; url: (h: string) => string; check?: Check }

/** Redes em que a existência do perfil pode ser confirmada sem login. */
export const CONFIRMABLE: Site[] = [
  {
    name: 'GitHub', url: (h) => `https://github.com/${h}`,
    check: async (h) => {
      try {
        const u = await fetchJson(`https://api.github.com/users/${h}`, { timeoutMs: TIMEOUT });
        return { found: true, detail: [u.name, u.bio, u.location, u.public_repos != null ? `${u.public_repos} repositório(s) público(s)` : ''].filter(Boolean).join(' · '), date: u.created_at };
      } catch (e: any) { return e.status === 404 ? { found: false } : null; }
    },
  },
  {
    name: 'Bluesky', url: (h) => `https://bsky.app/profile/${h.includes('.') ? h : `${h}.bsky.social`}`,
    check: async (h) => {
      try {
        const p = await fetchJson(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(h.includes('.') ? h : `${h}.bsky.social`)}`, { timeoutMs: TIMEOUT });
        return { found: true, detail: [p.displayName, p.description?.slice(0, 160), `${p.postsCount ?? 0} publicação(ões), ${p.followersCount ?? 0} seguidor(es)`].filter(Boolean).join(' · '), date: p.createdAt };
      } catch (e: any) { return e.status === 400 || e.status === 404 ? { found: false } : null; }
    },
  },
  {
    name: 'Mastodon (mastodon.social)', url: (h) => `https://mastodon.social/@${h}`,
    check: async (h) => {
      try {
        const a = await fetchJson(`https://mastodon.social/api/v1/accounts/lookup?acct=${encodeURIComponent(h)}`, { timeoutMs: TIMEOUT });
        return { found: true, detail: [a.display_name, `${a.statuses_count ?? 0} publicação(ões)`].filter(Boolean).join(' · '), date: a.created_at };
      } catch (e: any) { return e.status === 404 ? { found: false } : null; }
    },
  },
  {
    name: 'GitLab', url: (h) => `https://gitlab.com/${h}`,
    check: async (h) => {
      const list = await fetchJson(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(h)}`, { timeoutMs: TIMEOUT });
      return Array.isArray(list) ? { found: list.length > 0, detail: list[0]?.name } : null;
    },
  },
];

/** Redes que exigem login para responder: o app só monta o link para o profissional conferir. */
export const MANUAL: Site[] = [
  { name: 'X (Twitter)', url: (h) => `https://x.com/${h}` },
  { name: 'YouTube', url: (h) => `https://www.youtube.com/@${h}` },
  { name: 'Telegram', url: (h) => `https://t.me/${h}` },
  { name: 'SoundCloud', url: (h) => `https://soundcloud.com/${h}` },
  { name: 'Vimeo', url: (h) => `https://vimeo.com/${h}` },
  { name: 'Linktree', url: (h) => `https://linktr.ee/${h}` },
  { name: 'Instagram', url: (h) => `https://www.instagram.com/${h}/` },
  { name: 'Facebook', url: (h) => `https://www.facebook.com/${h}` },
  { name: 'TikTok', url: (h) => `https://www.tiktok.com/@${h}` },
  { name: 'Threads', url: (h) => `https://www.threads.net/@${h}` },
  { name: 'LinkedIn', url: (h) => `https://www.linkedin.com/in/${h}` },
  { name: 'Kwai', url: (h) => `https://www.kwai.com/@${h}` },
  { name: 'Pinterest', url: (h) => `https://www.pinterest.com/${h}/` },
];

const norm = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
/** O nome exibido contém todas as palavras relevantes do nome pesquisado. */
export const sameName = (shown: string, wanted: string) => {
  const w = norm(wanted).split(' ').filter((x) => x.length > 2 && !['dos', 'das', 'ltda', 'eireli'].includes(x));
  const s = ` ${norm(shown)} `;
  return w.length > 0 && w.every((x) => s.includes(` ${x} `));
};

async function pool<T>(items: (() => Promise<T>)[], size = 4): Promise<T[]> {
  const out: T[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await items[k](); }
  }));
  return out;
}

export const socialConnector: Connector = {
  id: 'redes-sociais',
  name: 'Redes sociais e perfis públicos',
  category: 'redes',
  description: 'Perfis por nome de usuário (GitHub, Bluesky, X, YouTube, Telegram, Mastodon e outros), contas com o mesmo nome e publicações públicas que citam o nome. Instagram, Facebook, TikTok e LinkedIn exigem login: o app gera o link para conferência manual.',
  capabilities: ['nome'],
  website: 'https://bsky.app/',
  async isEnabled() { return { enabled: true }; },
  appliesTo: (q) => !!(q.name || q.usernames?.length),
  async search(q, ctx) {
    const handles = parseHandles(q.usernames);
    const name = (q.kind === 'PJ' && q.tradeName ? q.tradeName : q.name || '').trim();
    const records: FoundRecord[] = [];
    const notes: string[] = [];

    // 1) Nomes de usuário informados
    const jobs = handles.flatMap((h) => CONFIRMABLE.map((site) => async () => {
      try { return { h, site, r: await site.check!(h) }; } catch { return { h, site, r: null }; }
    }));
    const checks = await pool(jobs, 4);
    for (const { h, site, r } of checks) {
      if (r?.found) records.push({ title: `${site.name} — perfil @${h} encontrado`, detail: (r.detail || 'Perfil público existente.').replace(/\s+/g, ' ').trim().replace(/\s*·\s*$/, ''), date: r.date, url: site.url(h) });
    }
    const unsure = checks.filter((c) => c.r == null).map((c) => `${c.site.name} (@${c.h})`);
    if (unsure.length) notes.push(`sem resposta: ${unsure.join(', ')}`);
    for (const h of handles) for (const site of MANUAL)
      records.push({ title: `${site.name} — @${h} (conferir manualmente)`, detail: 'Esta rede não permite conferir o perfil pelo navegador sem login; abra o link para ver se ele existe e se pertence ao investigado.', url: site.url(h) });

    // 2) Contas com o mesmo nome
    if (name.length >= 5) {
      try {
        const r = await fetchJson(`https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(name)}&limit=25`, { timeoutMs: TIMEOUT });
        for (const a of (r?.actors || []).filter((a: any) => sameName(a.displayName || '', name)).slice(0, 5))
          records.push({ title: `Bluesky — conta com o mesmo nome: @${a.handle}`, detail: [a.displayName, a.description?.slice(0, 160)].filter(Boolean).join(' · '), date: a.createdAt, url: `https://bsky.app/profile/${a.handle}` });
      } catch { notes.push('busca de contas no Bluesky sem resposta'); }
      try {
        const r = await fetchJson(`https://api.github.com/search/users?q=${encodeURIComponent(`fullname:"${name}"`)}&per_page=5`, { timeoutMs: TIMEOUT });
        for (const u of (r?.items || []).slice(0, 5))
          records.push({ title: `GitHub — conta com o mesmo nome: @${u.login}`, detail: 'Nome completo cadastrado igual ao pesquisado.', url: u.html_url });
      } catch { notes.push('busca de contas no GitHub sem resposta'); }

      // 3) Publicações que citam o nome
      try {
        const r = await fetchJson(`https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(`"${name}"`)}&limit=15&sort=latest`, { timeoutMs: TIMEOUT });
        for (const p of r?.posts || []) {
          const id = String(p.uri || '').split('/').pop();
          records.push({ title: `Bluesky — publicação de @${p.author?.handle} citando o nome`, detail: String(p.record?.text || '').replace(/\s+/g, ' ').slice(0, 400), date: p.record?.createdAt || p.indexedAt, url: `https://bsky.app/profile/${p.author?.handle}/post/${id}` });
        }
      } catch { notes.push('busca de publicações no Bluesky sem resposta'); }

    }

    const confirmed = records.filter((r) => /encontrado$/.test(r.title)).length;
    const posts = records.filter((r) => /cita/.test(r.title)).length;
    const same = records.filter((r) => /mesmo nome/.test(r.title)).length;
    return {
      ok: true,
      processes: [],
      records,
      message: [
        handles.length ? `${confirmed} perfil(is) confirmado(s) para ${handles.map((h) => `@${h}`).join(', ')}` : 'nenhum nome de usuário informado',
        `${same} conta(s) com o mesmo nome`, `${posts} publicação(ões) citando o nome`, ...notes,
      ].join('; ') + '.',
    };
  },
};
