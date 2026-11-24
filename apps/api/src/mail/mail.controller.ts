import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public } from '../auth/decorators';
import { AuditService } from '../system/audit.service';
import { ComposeInput, MailService } from './mail.service';

const origin = (req: Request) => `${req.protocol}://${req.get('host')}`;

@Controller('api/mail')
export class MailController {
  constructor(private mail: MailService, private audit: AuditService) {}

  @Get('account')
  account(@CurrentUser() user: AuthUser) {
    return this.mail.account(user.id);
  }

  @Post('oauth/start')
  start(@CurrentUser() user: AuthUser, @Req() req: Request, @Body() body: { returnTo?: string }) {
    return this.mail.start(user.id, origin(req), body.returnTo || '/configuracoes/');
  }

  /** O Google redireciona o navegador para cá depois da autorização. */
  @Public() @Get('oauth/callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Req() req: Request, @Res() res: Response) {
    if (error) return res.redirect(`/configuracoes/?gmail=erro&motivo=${encodeURIComponent(error)}`);
    try {
      const r = await this.mail.callback(code, state, origin(req));
      await this.audit.log({ userId: r.userId, action: 'email.gmail_conectado', details: { email: r.email } });
      const sep = r.returnTo.includes('?') ? '&' : '?';
      res.redirect(`${r.returnTo}${sep}gmail=ok`);
    } catch (e) {
      res.redirect(`/configuracoes/?gmail=erro&motivo=${encodeURIComponent(e.message)}`);
    }
  }

  /** Página final do OAuth quando aberto no navegador do sistema (app desktop). */
  @Public() @Get('oauth/done')
  done(@Query('gmail') status: string, @Res() res: Response) {
    const ok = status === 'ok';
    res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Lex Detetive</title><body style="font-family:system-ui;background:#0B1F3A;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#C9A227">${ok ? 'Gmail conectado' : 'Não foi possível conectar'}</h1><p>${ok ? 'Pode fechar esta aba e voltar ao Lex Detetive.' : 'Volte ao Lex Detetive e tente novamente.'}</p></div></body>`);
  }

  @Post('app-password')
  async appPassword(@CurrentUser() user: AuthUser, @Body() body: { email: string; password: string }) {
    const r = await this.mail.connectAppPassword(user.id, body.email, body.password);
    await this.audit.log({ userId: user.id, action: 'email.gmail_conectado', details: { email: r.email, metodo: 'senha_app' } });
    return this.mail.account(user.id);
  }

  @Delete('account')
  async disconnect(@CurrentUser() user: AuthUser) {
    await this.mail.disconnect(user.id);
    await this.audit.log({ userId: user.id, action: 'email.gmail_desconectado' });
    return { ok: true };
  }

  @Get('messages')
  list(@CurrentUser() user: AuthUser, @Query('folder') folder?: string, @Query('q') q?: string, @Query('clientId') clientId?: string) {
    return this.mail.list(user.id, folder, q, clientId);
  }

  @Get('messages/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mail.get(user.id, id);
  }

  @Delete('messages/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.mail.remove(user.id, id);
    return { ok: true };
  }

  @Post('drafts')
  draft(@CurrentUser() user: AuthUser, @Body() body: ComposeInput) {
    return this.mail.saveDraft(user.id, user.name, body);
  }

  @Post('send')
  async send(@CurrentUser() user: AuthUser, @Body() body: ComposeInput) {
    const msg = await this.mail.send(user.id, user.name, body);
    await this.audit.log({ userId: user.id, action: 'email.enviado', entity: 'EmailMessage', entityId: msg.id, details: { para: body.to?.length, ia: !!body.aiAssisted } });
    return msg;
  }

  @Get('gmail/sent')
  gmailSent(@CurrentUser() user: AuthUser) {
    return this.mail.gmailSent(user.id);
  }
}
