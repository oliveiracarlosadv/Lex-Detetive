import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'crypto';
import { fetchJson } from '../common/json';
import { exchangeCode, pkcePair } from '../mail/gmail';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../system/audit.service';
import { SettingsService } from '../system/settings.service';
import { AuthService } from './auth.service';

/** Endereço do próprio computador (o início local sem senha nunca vale pela rede). */
export const isLoopback = (ip?: string) => !!ip && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Formas de acesso além de e-mail e senha:
 *  - início local sem senha (offline, só no próprio computador);
 *  - "Esqueci minha senha": código de 6 dígitos enviado ao e-mail cadastrado;
 *  - "Entrar com Google": conta Google cujo e-mail é de um usuário cadastrado.
 */
@Injectable()
export class AccessService {
  private resetCodes = new Map<string, { hash: string; exp: number; tries: number }>();
  private forgotRate = new Map<string, number>();
  private google = new Map<string, { verifier: string; at: number; result?: { token: string; user: unknown } | { error: string } }>();

  constructor(
    private prisma: PrismaService, private settings: SettingsService, private auth: AuthService,
    private audit: AuditService, private mail: MailService, private jwt: JwtService,
  ) {}

  async options() {
    const clientId = await this.settings.get('gmail.clientId');
    const secret = await this.settings.get('gmail.clientSecret');
    return {
      localLogin: (await this.settings.get('auth.localMode')) === 'true',
      googleLogin: !!(clientId && secret),
      passwordReset: await this.mail.canSendSystemMail(),
    };
  }

  // ---------------- início local sem senha ----------------
  async setLocalMode(userId: string, enabled: boolean, password?: string) {
    // Ao desligar, define a senha das próximas entradas (quem começou sem senha não sabe a aleatória).
    if (!enabled && password !== undefined) {
      if (password.length < 8) throw new BadRequestException('A senha precisa ter pelo menos 8 caracteres.');
      await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 12) } });
    }
    await this.settings.set('auth.localMode', enabled ? 'true' : 'false');
    await this.settings.set('auth.localUserId', enabled ? userId : null);
    await this.audit.log({ userId, action: enabled ? 'acesso.local_sem_senha_ativado' : 'acesso.local_sem_senha_desativado' });
    return this.options();
  }

  /** Primeiro uso "sem senha": cria o administrador com senha aleatória e liga o início local. */
  async setupLocal(data: { name: string; email: string }, ip?: string) {
    if (!isLoopback(ip)) throw new ForbiddenException('O uso sem senha só pode ser configurado no próprio computador.');
    const r = await this.auth.setup({ name: data.name, email: data.email, password: randomBytes(24).toString('base64url') });
    await this.setLocalMode(r.user.id, true);
    return r;
  }

  async localLogin(ip?: string) {
    if ((await this.settings.get('auth.localMode')) !== 'true') throw new ForbiddenException('O início sem senha está desligado.');
    if (!isLoopback(ip)) throw new ForbiddenException('O início sem senha só funciona no próprio computador.');
    const id = await this.settings.get('auth.localUserId');
    const user = (id && (await this.prisma.user.findFirst({ where: { id, active: true } })))
      || (await this.prisma.user.findFirst({ where: { role: 'admin', active: true }, orderBy: { createdAt: 'asc' } }));
    if (!user) throw new UnauthorizedException('Nenhum usuário ativo para o início local.');
    await this.audit.log({ userId: user.id, action: 'login.local_sem_senha', ip });
    return this.auth.issue(user);
  }

  // ---------------- esqueci minha senha ----------------
  async forgot(email: string, ip?: string) {
    const key = (email || '').trim().toLowerCase();
    const last = this.forgotRate.get(key) || 0;
    if (Date.now() - last < 60_000) throw new BadRequestException('Aguarde 1 minuto para pedir outro código.');
    this.forgotRate.set(key, Date.now());
    const user = await this.prisma.user.findUnique({ where: { email: key } });
    // Resposta igual para e-mail cadastrado ou não (não revela quem tem conta).
    const generic = { ok: true, message: 'Se este e-mail estiver cadastrado, enviamos um código de 6 dígitos. Ele vale por 15 minutos.' };
    if (!user || !user.active) return generic;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.resetCodes.set(key, { hash: sha(code), exp: Date.now() + 15 * 60_000, tries: 0 });
    try {
      await this.mail.sendSystemMail(user.id, user.email, 'Lex Detetive — código para criar nova senha', `
        <p>Olá, ${user.name.split(' ')[0]}.</p>
        <p>Seu código para criar uma nova senha no Lex Detetive é:</p>
        <p style="font-size:24pt;font-weight:bold;letter-spacing:6px">${code}</p>
        <p>Ele vale por 15 minutos. Se não foi você que pediu, ignore este e-mail — sua senha atual continua valendo.</p>`);
    } catch (e) {
      this.resetCodes.delete(key);
      this.forgotRate.delete(key);
      throw e;
    }
    await this.audit.log({ userId: user.id, action: 'senha.codigo_enviado', ip });
    return generic;
  }

  async reset(email: string, code: string, password: string, ip?: string) {
    const key = (email || '').trim().toLowerCase();
    const entry = this.resetCodes.get(key);
    if (!entry || entry.exp < Date.now()) throw new BadRequestException('Código expirado ou inexistente. Peça um novo.');
    if (entry.tries >= 5) { this.resetCodes.delete(key); throw new BadRequestException('Muitas tentativas. Peça um novo código.'); }
    if (entry.hash !== sha((code || '').replace(/\D/g, ''))) { entry.tries++; throw new BadRequestException('Código incorreto.'); }
    if (!password || password.length < 8) throw new BadRequestException('A nova senha precisa ter pelo menos 8 caracteres.');
    const user = await this.prisma.user.update({ where: { email: key }, data: { passwordHash: await bcrypt.hash(password, 12) } });
    this.resetCodes.delete(key);
    await this.audit.log({ userId: user.id, action: 'senha.redefinida_por_codigo', ip });
    return this.auth.issue(user);
  }

  // ---------------- entrar com Google ----------------
  private async googleCreds() {
    const clientId = await this.settings.get('gmail.clientId');
    const clientSecret = await this.settings.get('gmail.clientSecret');
    if (!clientId || !clientSecret) throw new BadRequestException('Entrar com Google exige as credenciais do Google em Configurações → E-mail → Avançado.');
    return { clientId, clientSecret };
  }

  /** Inicia o login Google. O app acompanha o resultado pelo "nonce" (funciona no navegador e no app desktop). */
  async googleStart(apiOrigin: string) {
    const { clientId } = await this.googleCreds();
    const nonce = randomBytes(18).toString('base64url');
    const { verifier, challenge } = pkcePair();
    this.google.set(nonce, { verifier, at: Date.now() });
    for (const [k, v] of this.google) if (Date.now() - v.at > 10 * 60_000) this.google.delete(k);
    const state = await this.jwt.signAsync({ n: nonce, k: 'google-login' }, { expiresIn: '10m' });
    const q = new URLSearchParams({
      client_id: clientId, redirect_uri: `${apiOrigin}/api/auth/google/callback`, response_type: 'code',
      scope: 'openid email profile', prompt: 'select_account', state, code_challenge: challenge, code_challenge_method: 'S256',
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${q}`, nonce };
  }

  async googleCallback(code: string, state: string, apiOrigin: string) {
    const payload = await this.jwt.verifyAsync<{ n: string; k: string }>(state).catch(() => null);
    const entry = payload?.k === 'google-login' ? this.google.get(payload.n) : undefined;
    if (!payload || !entry) return { ok: false, message: 'Sessão expirada. Volte ao Lex Detetive e tente de novo.' };
    try {
      const tokens = await exchangeCode({ ...(await this.googleCreds()), code, redirectUri: `${apiOrigin}/api/auth/google/callback`, verifier: entry.verifier });
      const info = await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (!info?.email || info.email_verified === false) throw new Error('A conta Google não informou um e-mail verificado.');
      const user = await this.prisma.user.findUnique({ where: { email: String(info.email).toLowerCase() } });
      if (!user || !user.active) throw new Error(`O e-mail ${info.email} não é de um usuário cadastrado no Lex Detetive.`);
      entry.result = await this.auth.issue(user);
      await this.audit.log({ userId: user.id, action: 'login.google' });
      return { ok: true, message: `Pronto, ${user.name.split(' ')[0]}! Pode voltar ao Lex Detetive.` };
    } catch (e) {
      entry.result = { error: e.message };
      return { ok: false, message: e.message };
    }
  }

  googlePoll(nonce: string) {
    const entry = this.google.get(nonce);
    if (!entry) return { error: 'Sessão expirada. Tente de novo.' };
    if (!entry.result) return { pending: true };
    this.google.delete(nonce);
    return entry.result;
  }
}
