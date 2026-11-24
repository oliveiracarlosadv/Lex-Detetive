import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { ALLOW_READER, IS_PUBLIC, ROLES, Role } from './decorators';

/**
 * Controle de acesso:
 * - toda rota exige token, salvo @Public();
 * - "leitor" só pode fazer leituras (GET);
 * - @Roles(...) restringe a perfis específicos.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query?.token as string | undefined);
    if (!token) throw new UnauthorizedException('Sessão expirada. Entre novamente.');

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) throw new UnauthorizedException('Usuário inativo.');
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role as Role };

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (roles && !roles.includes(req.user.role)) throw new ForbiddenException('Seu perfil não tem acesso a esta função.');
    if (req.user.role === 'leitor' && req.method !== 'GET' && !this.reflector.getAllAndOverride<boolean>(ALLOW_READER, targets)) throw new ForbiddenException('Perfil leitor: somente consulta.');
    return true;
  }
}
