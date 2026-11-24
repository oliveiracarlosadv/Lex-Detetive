import { Body, Controller, Get, Ip, Param, Patch, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AllowReader, AuthUser, CurrentUser, Public, Roles } from './decorators';

@Controller('api')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public() @Get('auth/status')
  async status() {
    return { needsSetup: await this.auth.needsSetup(), app: 'Lex Detetive', version: process.env.LEX_VERSION || '0.1.2' };
  }

  @Public() @Post('auth/setup')
  setup(@Body() body: { name: string; email: string; password: string }) {
    return this.auth.setup(body);
  }

  @Public() @Post('auth/login')
  login(@Body() body: { email: string; password: string; code?: string }, @Ip() ip: string) {
    return this.auth.login(body.email, body.password, body.code, ip);
  }

  @Get('auth/me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @AllowReader() @Patch('auth/profile')
  profile(@CurrentUser() user: AuthUser, @Body() body: { name?: string; office?: string; activity?: string; registryType?: string; registryNumber?: string; registryUf?: string }) {
    return this.auth.updateProfile(user.id, body);
  }

  @AllowReader() @Post('auth/profile/logo')
  setLogo(@CurrentUser() user: AuthUser, @Body() body: { dataUrl: string | null }) {
    return this.auth.setLogo(user.id, body.dataUrl || null);
  }

  @Get('auth/profile/logo')
  async logo(@CurrentUser() user: AuthUser) {
    return { dataUrl: await this.auth.logo(user.id) };
  }

  // 2FA e senha valem para qualquer perfil, inclusive leitor.
  @AllowReader() @Post('auth/2fa/setup')
  start2fa(@CurrentUser() user: AuthUser) {
    return this.auth.start2fa(user.id);
  }

  @AllowReader() @Post('auth/2fa/enable')
  enable2fa(@CurrentUser() user: AuthUser, @Body() body: { code: string }) {
    return this.auth.confirm2fa(user.id, body.code, true);
  }

  @AllowReader() @Post('auth/2fa/disable')
  disable2fa(@CurrentUser() user: AuthUser, @Body() body: { code: string }) {
    return this.auth.confirm2fa(user.id, body.code, false);
  }

  @AllowReader() @Post('auth/password')
  password(@CurrentUser() user: AuthUser, @Body() body: { current: string; next: string }) {
    return this.auth.changePassword(user.id, body.current, body.next);
  }

  @Roles('admin') @Get('users')
  users() {
    return this.auth.listUsers();
  }

  @Roles('admin') @Post('users')
  createUser(@CurrentUser() user: AuthUser, @Body() body: { name: string; email: string; password: string; role: string }) {
    return this.auth.createUser(user.id, body);
  }

  @Roles('admin') @Patch('users/:id')
  updateUser(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { role?: string; active?: boolean }) {
    return this.auth.updateUser(user.id, id, body);
  }
}
