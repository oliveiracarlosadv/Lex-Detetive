/**
 * Gmail por "senha de app" (forma simples, sem Google Cloud):
 *  - envio por SMTP (smtp.gmail.com) — o Gmail guarda a mensagem em "Enviados";
 *  - rascunhos e leitura de "Enviados" por IMAP (imap.gmail.com).
 * Bibliotecas carregadas só quando usadas.
 */
export interface AppPasswordAccount { email: string; password: string }

const friendly = (e: any): Error => {
  const m = String(e?.response || e?.message || e);
  if (/Invalid login|BadCredentials|AUTHENTICATIONFAILED|535|Application-specific password required/i.test(m))
    return new Error('O Google recusou o e-mail ou a senha de app. Confira se copiou a senha de 16 letras (sem espaços) e se a verificação em duas etapas está ativa.');
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|getaddrinfo/i.test(m)) return new Error('Sem conexão com o Gmail. Verifique a internet.');
  return new Error(`Gmail: ${m.slice(0, 200)}`);
};

async function smtp(acc: AppPasswordAccount) {
  const nodemailer = await import('nodemailer');
  return nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: acc.email, pass: acc.password.replace(/\s/g, '') } });
}

async function imap<T>(acc: AppPasswordAccount, fn: (client: any) => Promise<T>): Promise<T> {
  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: acc.email, pass: acc.password.replace(/\s/g, '') }, logger: false });
  try {
    await client.connect();
    return await fn(client);
  } catch (e) {
    throw friendly(e);
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/** Pastas especiais do Gmail (os nomes variam com o idioma: "Rascunhos", "Drafts"…). */
async function specialMailbox(client: any, use: '\\Drafts' | '\\Sent'): Promise<string> {
  const list = await client.list();
  const box = list.find((b: any) => b.specialUse === use);
  if (!box) throw new Error(`Pasta ${use === '\\Drafts' ? 'Rascunhos' : 'Enviados'} não encontrada no Gmail.`);
  return box.path;
}

export async function verifyAppPassword(acc: AppPasswordAccount) {
  try { await (await smtp(acc)).verify(); } catch (e) { throw friendly(e); }
}

export async function sendRaw(acc: AppPasswordAccount, raw: Buffer, envelope: { from: string; to: string[] }) {
  try {
    const info = await (await smtp(acc)).sendMail({ envelope, raw });
    return { id: info.messageId as string };
  } catch (e) { throw friendly(e); }
}

/** Grava (ou substitui) o rascunho na pasta Rascunhos do Gmail. Retorna o UID. */
export async function saveDraft(acc: AppPasswordAccount, raw: Buffer, previousUid?: string | null) {
  return imap(acc, async (client) => {
    const path = await specialMailbox(client, '\\Drafts');
    const res = await client.append(path, raw, ['\\Draft', '\\Seen']);
    if (previousUid) {
      const lock = await client.getMailboxLock(path);
      try { await client.messageDelete(previousUid, { uid: true }); } catch { /* já removido */ } finally { lock.release(); }
    }
    return res?.uid ? String(res.uid) : null;
  });
}

export async function deleteDraft(acc: AppPasswordAccount, uid: string) {
  return imap(acc, async (client) => {
    const path = await specialMailbox(client, '\\Drafts');
    const lock = await client.getMailboxLock(path);
    try { await client.messageDelete(uid, { uid: true }); } finally { lock.release(); }
  });
}

/** Últimas mensagens da pasta "Enviados" do Gmail. */
export async function listSent(acc: AppPasswordAccount, max = 25) {
  return imap(acc, async (client) => {
    const path = await specialMailbox(client, '\\Sent');
    const lock = await client.getMailboxLock(path);
    const out: { id: string; to: string; subject: string; date: string; snippet: string }[] = [];
    try {
      const total = client.mailbox?.exists || 0;
      if (!total) return out;
      for await (const m of client.fetch(`${Math.max(1, total - max + 1)}:*`, { envelope: true, uid: true })) {
        out.push({
          id: String(m.uid),
          to: (m.envelope?.to || []).map((t: any) => t.address).join(', '),
          subject: m.envelope?.subject || '',
          date: m.envelope?.date ? new Date(m.envelope.date).toISOString() : '',
          snippet: '',
        });
      }
    } finally { lock.release(); }
    return out.reverse();
  });
}
