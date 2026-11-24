import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { PrismaService } from '../prisma.service';
import { decrypt, encrypt } from '../common/crypto';
import { AuditService } from '../system/audit.service';

const publicUser = (u: any) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, totpEnabled: u.totpEnabled, active: u.active, createdAt: u.createdAt,
  office: u.office, activity: u.activity, registryType: u.registryType, registryNumber: u.registryNumber, registryUf: u.registryUf,
  hasLogo: !!u.logo,
});

/** "OAB/PA 12.345" a partir do perfil. */
export const registryLabel = (u: { registryType?: string | null; registryNumber?: string | null; registryUf?: string | null }) =>
  u.registryType && u.registryNumber ? `${u.registryType}${u.registryUf ? `/${u.registryUf}` : ''} ${u.registryNumber}` : '';

function checkPassword(password: string) {
  if (!password || password.length < 8) throw new BadRequestException('A senha precisa ter pelo menos 8 caracteres.');
}

@Injectable()
export class AuthService {
  private attempts = new Map<string, { count: number; until: number }>();

  constructor(private prisma: PrismaService, private jwt: JwtService, private audit: AuditService) {}

  async needsSetup() {
    return (await this.prisma.user.count()) === 0;
  }

  async setup(data: { name: string; email: string; password: string }) {
    if (!(await this.needsSetup())) throw new ForbiddenException('O sistema já foi configurado.');
    checkPassword(data.password);
    const user = await this.prisma.user.create({
      data: { name: data.name.trim(), email: data.email.trim().toLowerCase(), passwordHash: await bcrypt.hash(data.password, 12), role: 'admin' },
    });
    await this.audit.log({ userId: user.id, action: 'setup.admin_criado', entity: 'User', entityId: user.id });
    return this.issue(user);
  }

  async login(email: string, password: string, code?: string, ip?: string) {
    const key = (email || '').trim().toLowerCase();
    const lock = this.attempts.get(key);
    if (lock && lock.until > Date.now()) throw new UnauthorizedException('Muitas tentativas. Aguarde alguns minutos.');

    const user = await this.prisma.user.findUnique({ where: { email: key } });
    if (!user || !user.active || !(await bcrypt.compare(password || '', user.passwordHash))) {
      const count = (lock?.count || 0) + 1;
      this.attempts.set(key, { count, until: count >= 5 ? Date.now() + 5 * 60_000 : 0 });
      await this.audit.log({ action: 'login.falha', details: { email: key }, ip });
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    if (user.totpEnabled) {
      if (!code) return { requires2fa: true };
      if (!authenticator.verify({ token: code.replace(/\s/g, ''), secret: decrypt(user.totpSecret!) })) {
        await this.audit.log({ userId: user.id, action: 'login.2fa_invalido', ip });
        throw new UnauthorizedException('Código de verificação inválido.');
      }
    }
    this.attempts.delete(key);
    await this.audit.log({ userId: user.id, action: 'login.sucesso', ip });
    return this.issue(user);
  }

  async issue(user: { id: string; name: string; email: string; role: string; totpEnabled: boolean }) {
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { token, user: publicUser(user) };
  }

  async me(id: string) {
    return publicUser(await this.prisma.user.findUniqueOrThrow({ where: { id } }));
  }

  async updateProfile(userId: string, data: { name?: string; office?: string; activity?: string; registryType?: string; registryNumber?: string; registryUf?: string }) {
    const clean = (v?: string) => (v === undefined ? undefined : v.trim() || null);
    if (data.name !== undefined && !data.name.trim()) throw new BadRequestException('Informe o nome.');
    if (data.registryUf && !/^[A-Za-z]{2}$/.test(data.registryUf.trim())) throw new BadRequestException('UF deve ter 2 letras.');
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name?.trim(), office: clean(data.office), activity: clean(data.activity), registryType: clean(data.registryType),
        registryNumber: clean(data.registryNumber), registryUf: data.registryUf === undefined ? undefined : data.registryUf.trim().toUpperCase() || null,
      },
    });
    await this.audit.log({ userId, action: 'perfil.alterado' });
    return publicUser(u);
  }

  /** Logomarca: PNG ou JPEG de até 1 MB, enviada como data URL. */
  async setLogo(userId: string, dataUrl: string | null) {
    if (dataUrl) {
      const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
      if (!m) throw new BadRequestException('Envie a logomarca em PNG ou JPG.');
      if (Buffer.from(m[2], 'base64').length > 1024 * 1024) throw new BadRequestException('A logomarca deve ter no máximo 1 MB.');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { logo: dataUrl } });
    await this.audit.log({ userId, action: dataUrl ? 'perfil.logo_enviada' : 'perfil.logo_removida' });
    return this.me(userId);
  }

  async logo(userId: string) {
    return (await this.prisma.user.findUnique({ where: { id: userId }, select: { logo: true } }))?.logo || null;
  }

  async start2fa(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: encrypt(secret), totpEnabled: false } });
    const uri = authenticator.keyuri(user.email, 'Lex Detetive', secret);
    const QRCode = await import('qrcode'); // carregado só ao ativar o 2FA
    return { secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  }

  async confirm2fa(userId: string, code: string, enable: boolean) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpSecret || !authenticator.verify({ token: (code || '').replace(/\s/g, ''), secret: decrypt(user.totpSecret) }))
      throw new BadRequestException('Código inválido.');
    await this.prisma.user.update({ where: { id: userId }, data: enable ? { totpEnabled: true } : { totpEnabled: false, totpSecret: null } });
    await this.audit.log({ userId, action: enable ? '2fa.ativado' : '2fa.desativado' });
    return { totpEnabled: enable };
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(current || '', user.passwordHash))) throw new BadRequestException('Senha atual incorreta.');
    checkPassword(next);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, 12) } });
    await this.audit.log({ userId, action: 'senha.alterada' });
    return { ok: true };
  }

  // ---- Gestão de usuários (admin) ----
  async listUsers() {
    return (await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } })).map(publicUser);
  }

  async createUser(actorId: string, data: { name: string; email: string; password: string; role: string }) {
    checkPassword(data.password);
    if (!['admin', 'analista', 'leitor'].includes(data.role)) throw new BadRequestException('Perfil inválido.');
    const email = data.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new BadRequestException('E-mail já cadastrado.');
    const user = await this.prisma.user.create({
      data: { name: data.name.trim(), email, role: data.role, passwordHash: await bcrypt.hash(data.password, 12) },
    });
    await this.audit.log({ userId: actorId, action: 'usuario.criado', entity: 'User', entityId: user.id, details: { email, role: data.role } });
    return publicUser(user);
  }

  async updateUser(actorId: string, id: string, data: { role?: string; active?: boolean }) {
    if (id === actorId && (data.active === false || (data.role && data.role !== 'admin')))
      throw new BadRequestException('Você não pode remover o próprio acesso de administrador.');
    const user = await this.prisma.user.update({ where: { id }, data: { role: data.role, active: data.active } });
    await this.audit.log({ userId: actorId, action: 'usuario.alterado', entity: 'User', entityId: id, details: data });
    return publicUser(user);
  }
}
