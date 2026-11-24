import { Body, Controller, Get, Ip, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AccessService } from './access.service';
import { AuthUser, CurrentUser, Public, Roles } from './decorators';

const origin = (req: Request) => `${req.protocol}://${req.get('host')}`;
const page = (title: string, msg: string, ok: boolean) => `<!doctype html><meta charset="utf-8"><title>Lex Detetive</title>
<body style="font-family:system-ui;background:#0B1F3A;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center;max-width:420px"><h1 style="color:${ok ? '#C9A227' : '#f87171'}">${title}</h1><p>${msg.replace(/</g, '&lt;')}</p></div></body>`;

@Controller('api/auth')
export class AccessController {
  constructor(private access: AccessService) {}

  @Public() @Get('options')
  options() {
    return this.access.options();
  }

  @Public() @Post('local')
  local(@Ip() ip: string, @Req() req: Request) {
    return this.access.localLogin(req.socket.remoteAddress || ip);
  }

  @Public() @Post('setup-local')
  setupLocal(@Body() body: { name: string; email: string }, @Req() req: Request) {
    return this.access.setupLocal(body, req.socket.remoteAddress);
  }

  @Roles('admin') @Post('local-mode')
  localMode(@CurrentUser() user: AuthUser, @Body() body: { enabled: boolean; password?: string }) {
    return this.access.setLocalMode(user.id, !!body.enabled, body.password || undefined);
  }

  @Public() @Post('forgot')
  forgot(@Body() body: { email: string }, @Ip() ip: string) {
    return this.access.forgot(body.email, ip);
  }

  @Public() @Post('reset')
  reset(@Body() body: { email: string; code: string; password: string }, @Ip() ip: string) {
    return this.access.reset(body.email, body.code, body.password, ip);
  }

  @Public() @Post('google/start')
  googleStart(@Req() req: Request) {
    return this.access.googleStart(origin(req));
  }

  @Public() @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Req() req: Request, @Res() res: Response) {
    if (error) return res.type('html').send(page('Login cancelado', 'Volte ao Lex Detetive e tente de novo.', false));
    const r = await this.access.googleCallback(code, state, origin(req));
    res.type('html').send(page(r.ok ? 'Login com Google concluído' : 'Não foi possível entrar', r.message, r.ok));
  }

  @Public() @Post('google/poll')
  googlePoll(@Body() body: { nonce: string }) {
    return this.access.googlePoll(body.nonce);
  }
}
