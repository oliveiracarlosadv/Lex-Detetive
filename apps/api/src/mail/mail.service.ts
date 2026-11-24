import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { decrypt, encrypt } from '../common/crypto';
import { parseJson } from '../common/json';
import { PrismaService } from '../prisma.service';
import type { ExportFormat } from '../reports/exporters';
import { buildReport, reportAuthor, ReportType } from '../reports/report.builder';
import { SettingsService } from '../system/settings.service';
import { TargetsService } from '../targets/targets.service';
import { authUrl, exchangeCode, gmail, pkcePair, refreshAccessToken, revoke } from './gmail';
import * as appPw from './gmail-app-password';

/**
 * Imagens embutidas (assinatura em imagem, logos colados) viram anexos "inline" (cid):
 * é o formato que o Gmail e os demais leitores exibem; data: URIs costumam ser bloqueadas.
 */
export function inlineImages(html: string) {
  let n = 0;
  const inline: { filename: string; content: Buffer; contentType: string; cid: string; contentDisposition: 'inline' }[] = [];
  const body = html.replace(/src="data:(image\/(png|jpeg|gif));base64,([A-Za-z0-9+/=]+)"/g, (_m, type: string, ext: string, data: string) => {
    const cid = `imagem${++n}@lexdetetive`;
    inline.push({ filename: `imagem${n}.${ext === 'jpeg' ? 'jpg' : ext}`, content: Buffer.from(data, 'base64'), contentType: type, cid, contentDisposition: 'inline' });
    return `src="cid:${cid}"`;
  });
  return { body, inline };
}

/** Padrão de texto dos e-mails: Arial 12, justificado. */
const EMAIL_STYLE = 'font-family:Arial,Helvetica,sans-serif;font-size:12pt;line-height:1.5;text-align:justify;color:#000';

export interface Attachment { filename: string; contentBase64?: string; mime?: string; report?: { targetId: string; type: ReportType; format: ExportFormat } }
export interface ComposeInput {
  id?: string; to: string[]; cc?: string[]; bcc?: string[]; subject: string; html: string;
  attachments?: Attachment[]; clientId?: string; processId?: string; targetId?: string; aiAssisted?: boolean;
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const MAX_ATTACH = 20 * 1024 * 1024; // limite prático do Gmail ~25 MB após codificação

@Injectable()
export class MailService {
  private pending = new Map<string, { verifier: string; userId: string; returnTo: string; at: number }>();

  constructor(private prisma: PrismaService, private settings: SettingsService, private jwt: JwtService, private targets: TargetsService) {}

  private async credentials() {
    const clientId = await this.settings.get('gmail.clientId');
    const clientSecret = await this.settings.get('gmail.clientSecret');
    if (!clientId || !clientSecret) throw new BadRequestException('Configure o Client ID e o Client Secret do Google em Configurações → E-mail.');
    return { clientId, clientSecret };
  }

  // ---------- conexão OAuth ----------
  async start(userId: string, apiOrigin: string, returnTo: string) {
    const { clientId } = await this.credentials();
    // Só volta para o próprio app (evita redirecionamento aberto).
    const okReturn = returnTo.startsWith('/') || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(returnTo) || returnTo.startsWith(apiOrigin + '/');
    if (!okReturn) returnTo = '/configuracoes/';
    const { verifier, challenge } = pkcePair();
    const state = await this.jwt.signAsync({ sub: userId, k: 'gmail' }, { expiresIn: '10m' });
    this.pending.set(state, { verifier, userId, returnTo, at: Date.now() });
    return { url: authUrl({ clientId, redirectUri: `${apiOrigin}/api/mail/oauth/callback`, state, challenge }) };
  }

  async callback(code: string, state: string, apiOrigin: string) {
    const p = this.pending.get(state);
    this.pending.delete(state);
    if (!p) throw new BadRequestException('Sessão de autorização expirada. Tente conectar novamente.');
    await this.jwt.verifyAsync(state);
    const creds = await this.credentials();
    const tokens = await exchangeCode({ ...creds, code, redirectUri: `${apiOrigin}/api/mail/oauth/callback`, verifier: p.verifier });
    if (!tokens.refresh_token) throw new BadRequestException('O Google não devolveu o token de acesso contínuo. Remova o acesso do app na conta Google e conecte de novo.');
    const profile = await gmail.profile(tokens.access_token);
    await this.prisma.mailAccount.upsert({
      where: { userId: p.userId },
      create: { userId: p.userId, email: profile.emailAddress, refreshTokenEnc: encrypt(tokens.refresh_token), scope: tokens.scope },
      update: { email: profile.emailAddress, refreshTokenEnc: encrypt(tokens.refresh_token), scope: tokens.scope },
    });
    return { returnTo: p.returnTo, email: profile.emailAddress as string, userId: p.userId };
  }

  async account(userId: string) {
    const acc = await this.prisma.mailAccount.findUnique({ where: { userId } });
    const configured = !!(await this.settings.get('gmail.clientId')) && !!(await this.settings.get('gmail.clientSecret'));
    return { configured, connected: !!acc, method: acc?.method, email: acc?.email, signature: (await this.settings.get('mail.signature')) || '', signatureImage: (await this.settings.get('mail.signatureImage')) || '' };
  }

  /** Forma simples: e-mail do Gmail + senha de app de 16 letras (sem Google Cloud). */
  async connectAppPassword(userId: string, email: string, password: string) {
    const e = (email || '').trim().toLowerCase();
    const pw = (password || '').replace(/\s/g, '');
    if (!EMAIL.test(e)) throw new BadRequestException('Informe um e-mail válido.');
    if (pw.length < 12) throw new BadRequestException('A senha de app do Google tem 16 letras. Copie a senha gerada em myaccount.google.com/apppasswords.');
    try { await appPw.verifyAppPassword({ email: e, password: pw }); } catch (err) { throw new BadRequestException(err.message); }
    await this.prisma.mailAccount.upsert({
      where: { userId },
      create: { userId, email: e, method: 'senha_app', appPasswordEnc: encrypt(pw), refreshTokenEnc: '' },
      update: { email: e, method: 'senha_app', appPasswordEnc: encrypt(pw), refreshTokenEnc: '' },
    });
    return { email: e };
  }

  async disconnect(userId: string) {
    const acc = await this.prisma.mailAccount.findUnique({ where: { userId } });
    if (!acc) return;
    if (acc.method === 'oauth' && acc.refreshTokenEnc) await revoke(decrypt(acc.refreshTokenEnc));
    await this.prisma.mailAccount.delete({ where: { userId } });
  }

  /** Canal de envio da conta conectada: senha de app (SMTP/IMAP) ou OAuth (API do Gmail). */
  /**
   * E-mail do próprio sistema (ex.: código de recuperação de senha). Sai pela conta Gmail
   * conectada do usuário; se ele não tiver, pela de um administrador.
   */
  async sendSystemMail(preferUserId: string, to: string, subject: string, html: string) {
    let acc = await this.prisma.mailAccount.findUnique({ where: { userId: preferUserId } });
    if (!acc) {
      const admins = await this.prisma.user.findMany({ where: { role: 'admin', active: true }, select: { id: true } });
      acc = await this.prisma.mailAccount.findFirst({ where: { userId: { in: admins.map((a) => a.id) } } });
    }
    if (!acc) throw new BadRequestException('Nenhuma conta Gmail está conectada ao sistema para enviar o código.');
    const ch = await this.channel(acc.userId);
    const { raw } = await this.raw(ch.from, { to: [to], subject, html }, 'Lex Detetive');
    await ch.send(raw, [to]);
    return { from: ch.from };
  }

  /** Há alguma conta Gmail conectada capaz de enviar e-mails do sistema? */
  async canSendSystemMail() {
    return (await this.prisma.mailAccount.count()) > 0;
  }

  private async channel(userId: string) {
    const acc = await this.prisma.mailAccount.findUnique({ where: { userId } });
    if (!acc) throw new BadRequestException('Conecte sua conta Gmail em Configurações → E-mail.');
    if (acc.method === 'senha_app') {
      const cred = { email: acc.email, password: decrypt(acc.appPasswordEnc!) };
      return {
        from: acc.email,
        send: async (raw: Buffer, to: string[]) => ({ ...(await appPw.sendRaw(cred, raw, { from: acc.email, to })), threadId: null as string | null }),
        saveDraft: (raw: Buffer, prev?: string | null) => appPw.saveDraft(cred, raw, prev),
        deleteDraft: (id: string) => appPw.deleteDraft(cred, id),
        listSent: () => appPw.listSent(cred),
      };
    }
    const token = await refreshAccessToken({ ...(await this.credentials()), refreshToken: decrypt(acc.refreshTokenEnc) });
    return {
      from: acc.email,
      send: async (raw: Buffer) => { const r = await gmail.send(token, raw.toString('base64url')); return { id: r.id as string, threadId: r.threadId as string | null }; },
      saveDraft: async (raw: Buffer, prev?: string | null) => (prev ? await gmail.updateDraft(token, prev, raw.toString('base64url')) : await gmail.createDraft(token, raw.toString('base64url'))).id as string,
      deleteDraft: async (id: string) => { await gmail.deleteDraft(token, id); },
      listSent: () => gmail.listSent(token),
    };
  }

  // ---------- composição ----------
  private validate(input: ComposeInput, sending: boolean) {
    const all = [...(input.to || []), ...(input.cc || []), ...(input.bcc || [])];
    for (const e of all) if (!EMAIL.test(e.trim())) throw new BadRequestException(`Endereço inválido: ${e}`);
    if (sending && !input.to?.length) throw new BadRequestException('Informe ao menos um destinatário.');
  }

  private async resolveAttachments(list: Attachment[] = [], userName: string, userId?: string) {
    const out: { filename: string; content: Buffer; contentType: string }[] = [];
    for (const a of list) {
      if (a.report) {
        const target: any = await this.targets.get(a.report.targetId);
        for (const p of target.processes) p.movements = await this.prisma.movement.findMany({ where: { processId: p.id }, orderBy: { date: 'desc' } });
        const report = buildReport(a.report.type, target, userId ? await reportAuthor(this.prisma, this.settings, userId, userName) : { user: userName, organization: (await this.settings.get('org.name')) || 'Lex Tecnologias' });
        const { exportReport, FORMATS } = await import('../reports/exporters');
        out.push({ filename: a.filename, content: await exportReport(report, a.report.format), contentType: FORMATS[a.report.format].mime.split(';')[0] });
      } else if (a.contentBase64) {
        out.push({ filename: a.filename, content: Buffer.from(a.contentBase64, 'base64'), contentType: a.mime || 'application/octet-stream' });
      }
    }
    if (out.reduce((s, a) => s + a.content.length, 0) > MAX_ATTACH) throw new BadRequestException('Anexos acima de 20 MB. O Gmail não aceita mensagens tão grandes.');
    return out;
  }

  private async raw(from: string, input: ComposeInput, userName: string, userId?: string) {
    const attachments = await this.resolveAttachments(input.attachments, userName, userId);
    const { body, inline } = inlineImages(input.html);
    const html = `<div style="${EMAIL_STYLE}">${body}</div>`;
    const text = input.html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    const { default: MailComposer } = await import('nodemailer/lib/mail-composer');
    const mime = await new MailComposer({
      from, to: input.to, cc: input.cc, bcc: input.bcc, subject: input.subject, html, text,
      attachments: [...attachments, ...inline], headers: { 'X-Mailer': 'Lex Detetive (Lex Tecnologias)' },
    }).compile().build();
    return { raw: mime, meta: attachments.map((a) => ({ filename: a.filename, size: a.content.length, mime: a.contentType })) };
  }

  private record(userId: string, input: ComposeInput) {
    return {
      userId, to: JSON.stringify(input.to || []), cc: JSON.stringify(input.cc || []), bcc: JSON.stringify(input.bcc || []),
      subject: input.subject || '(sem assunto)', html: input.html || '', clientId: input.clientId || null,
      processId: input.processId || null, targetId: input.targetId || null, aiAssisted: !!input.aiAssisted,
    };
  }

  /** Salva rascunho no app e também nos Rascunhos do Gmail (se conectado). */
  async saveDraft(userId: string, userName: string, input: ComposeInput) {
    this.validate(input, false);
    const existing = input.id ? await this.prisma.emailMessage.findFirst({ where: { id: input.id, userId } }) : null;
    let gmailDraftId = existing?.gmailDraftId || null;
    let attachments: unknown = existing?.attachments ? parseJson(existing.attachments) : [];
    let error: string | null = null;
    const acc = await this.prisma.mailAccount.findUnique({ where: { userId } });
    if (acc) {
      try {
        const ch = await this.channel(userId);
        const { raw, meta } = await this.raw(ch.from, input, userName, userId);
        attachments = meta;
        gmailDraftId = await ch.saveDraft(raw, gmailDraftId);
      } catch (e) { error = `Rascunho salvo só no app: ${e.message}`; }
    }
    const data = { ...this.record(userId, input), folder: 'rascunhos', gmailDraftId, attachments: JSON.stringify(attachments), error };
    const msg = existing
      ? await this.prisma.emailMessage.update({ where: { id: existing.id }, data })
      : await this.prisma.emailMessage.create({ data });
    return this.view(msg);
  }

  /** Envia pelo Gmail: a mensagem fica em "Enviados" do Gmail e na caixa de saída do app. */
  async send(userId: string, userName: string, input: ComposeInput) {
    this.validate(input, true);
    const existing = input.id ? await this.prisma.emailMessage.findFirst({ where: { id: input.id, userId } }) : null;
    const ch = await this.channel(userId);
    const from = ch.from;
    let raw: Buffer, meta: unknown;
    try { ({ raw, meta } = await this.raw(from, input, userName, userId)); }
    catch (e) { throw new BadRequestException(e.message); }
    const base = { ...this.record(userId, input), fromEmail: from, attachments: JSON.stringify(meta) };
    try {
      const sent = await ch.send(raw, [...input.to, ...(input.cc || []), ...(input.bcc || [])]);
      if (existing?.gmailDraftId) await ch.deleteDraft(existing.gmailDraftId).catch(() => undefined);
      const data = { ...base, folder: 'enviados', gmailMessageId: sent.id, gmailThreadId: sent.threadId, gmailDraftId: null, error: null, sentAt: new Date() };
      const msg = existing ? await this.prisma.emailMessage.update({ where: { id: existing.id }, data }) : await this.prisma.emailMessage.create({ data });
      return this.view(msg);
    } catch (e) {
      const data = { ...base, folder: 'falhas', error: e.message };
      const msg = existing ? await this.prisma.emailMessage.update({ where: { id: existing.id }, data }) : await this.prisma.emailMessage.create({ data });
      throw new BadRequestException({ message: `Falha ao enviar: ${e.message}`, id: msg.id });
    }
  }

  view(m: any) {
    return { ...m, to: parseJson(m.to, []), cc: parseJson(m.cc, []), bcc: parseJson(m.bcc, []), attachments: parseJson(m.attachments, []) };
  }

  async list(userId: string, folder?: string, q?: string, clientId?: string) {
    const rows = await this.prisma.emailMessage.findMany({
      where: { userId, folder: folder || undefined, clientId: clientId || undefined, ...(q ? { OR: [{ subject: { contains: q } }, { to: { contains: q } }] } : {}) },
      orderBy: { updatedAt: 'desc' }, take: 200,
    });
    return rows.map((m) => this.view(m));
  }

  async get(userId: string, id: string) {
    const m = await this.prisma.emailMessage.findFirst({ where: { id, userId } });
    if (!m) throw new NotFoundException();
    return this.view(m);
  }

  async remove(userId: string, id: string) {
    const m = await this.prisma.emailMessage.findFirst({ where: { id, userId } });
    if (!m) throw new NotFoundException();
    if (m.folder !== 'rascunhos' && m.folder !== 'falhas') throw new BadRequestException('Mensagens enviadas ficam guardadas para auditoria.');
    if (m.gmailDraftId) { try { await (await this.channel(userId)).deleteDraft(m.gmailDraftId); } catch { /* ignora */ } }
    await this.prisma.emailMessage.delete({ where: { id } });
  }

  async gmailSent(userId: string) {
    try { return await (await this.channel(userId)).listSent(); }
    catch (e) { throw new BadRequestException(e.message); }
  }
}
