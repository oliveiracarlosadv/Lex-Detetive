import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BackupService } from './backup.service';
import { AuthUser, CurrentUser, Public, Roles } from '../auth/decorators';
import { MonitoringService } from '../monitoring/monitoring.service';
import { AuditService } from './audit.service';
import { SETTING_DEFAULTS, SECRET_PREFIXES, SettingsService } from './settings.service';
import { DATA_DIR } from '../config';

const ALLOWED = (k: string) => k in SETTING_DEFAULTS || SECRET_PREFIXES.some((p) => k.startsWith(p)) || k.startsWith('ai.model.') || k.startsWith('ai.baseUrl.');

/** Versão lida do package.json do servidor (o app desktop também informa via LEX_VERSION). */
const APP_VERSION: string = (() => {
  try { return require('../../package.json').version; } catch { return '—'; }
})();

@Controller('api')
export class SystemController {
  constructor(private settings: SettingsService, private audit: AuditService, private monitoring: MonitoringService, private backup: BackupService) {}

  @Public() @Get('health')
  health() {
    return { ok: true, app: 'Lex Detetive', version: process.env.LEX_VERSION || APP_VERSION, time: new Date() };
  }

  @Get('settings')
  async list() {
    return { settings: await this.settings.listPublic(), dataDir: DATA_DIR, queue: this.monitoring.status() };
  }

  @Roles('admin') @Put('settings')
  async update(@CurrentUser() user: AuthUser, @Body() body: Record<string, string | null>) {
    for (const [k, v] of Object.entries(body)) {
      if (!ALLOWED(k)) throw new BadRequestException(`Configuração desconhecida: ${k}`);
      await this.settings.set(k, v);
    }
    // Nunca registrar valores de segredos na auditoria.
    await this.audit.log({ userId: user.id, action: 'configuracoes.alteradas', details: Object.keys(body) });
    return this.settings.listPublic();
  }

  @Roles('admin') @Get('audit')
  auditLog(@Query('limit') limit?: string) {
    return this.audit.list(Math.min(Number(limit) || 200, 1000));
  }

  @Roles('admin') @Get('backups')
  backups() {
    return this.backup.list();
  }

  @Roles('admin') @Post('backups')
  async createBackup(@CurrentUser() user: AuthUser, @Body() body: { reason?: string }) {
    const b = await this.backup.create(body?.reason === 'atualizacao' ? 'atualizacao' : 'manual');
    await this.audit.log({ userId: user.id, action: 'backup.criado', details: b });
    return b;
  }

  @Roles('admin') @Get('backups/:name')
  async download(@CurrentUser() user: AuthUser, @Param('name') name: string, @Res() res: Response) {
    const file = this.backup.path(name);
    await this.audit.log({ userId: user.id, action: 'backup.baixado', details: { name } });
    res.download(file);
  }
}
