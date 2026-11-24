import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Libera uma rota de escrita para o perfil leitor (ex.: trocar a própria senha). */
export const ALLOW_READER = 'allowReader';
export const AllowReader = () => SetMetadata(ALLOW_READER, true);

export const ROLES = 'roles';
export type Role = 'admin' | 'analista' | 'leitor';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export interface AuthUser { id: string; email: string; name: string; role: Role }

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
