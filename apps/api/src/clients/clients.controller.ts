import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../auth/decorators';
import { MonitoringService } from '../monitoring/monitoring.service';
import { AuditService } from '../system/audit.service';
import { PrismaService } from '../prisma.service';
import { ClientInput, ClientsService } from './clients.service';

@Controller('api')
export class ClientsController {
  constructor(private clients: ClientsService, private audit: AuditService, private monitoring: MonitoringService, private prisma: PrismaService) {}

  @Get('clients')
  list(@Query('q') q?: string, @Query('status') status?: string) {
    return this.clients.list(q, status);
  }

  @Post('clients')
  async create(@CurrentUser() user: AuthUser, @Body() body: ClientInput) {
    const c = await this.clients.create(body);
    await this.audit.log({ userId: user.id, action: 'cliente.criado', entity: 'Client', entityId: c.id });
    return this.clients.get(c.id);
  }

  @Get('alerts/parties')
  alertParties(@Query('unread') unread?: string) {
    return this.clients.alertParties(unread === 'true');
  }

  @Roles('admin', 'analista') @Post('clients/:id/link-many')
  async linkMany(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { processIds: string[]; role?: string }) {
    const r = await this.clients.linkMany(id, body?.processIds || [], body?.role);
    await this.audit.log({ userId: user.id, action: 'cliente.processos_vinculados_alertas', entity: 'Client', entityId: id, details: { quantidade: r.linked } });
    return r;
  }

  @Post('clients/suggest')
  suggest(@Body() body: { parties?: { name: string; role?: string }[]; document?: string }) {
    return this.clients.suggest((body.parties || []).slice(0, 50), body.document);
  }

  @Get('clients/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('reveal') reveal?: string) {
    const show = reveal === 'true' && user.role !== 'leitor';
    if (show) await this.audit.log({ userId: user.id, action: 'dados_sensiveis.visualizados', entity: 'Client', entityId: id });
    return this.clients.get(id, show);
  }

  @Patch('clients/:id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<ClientInput>) {
    await this.clients.update(id, body);
    await this.audit.log({ userId: user.id, action: 'cliente.alterado', entity: 'Client', entityId: id, details: Object.keys(body) });
    return this.clients.get(id);
  }

  @Roles('admin', 'analista') @Delete('clients/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.clients.remove(id);
    await this.audit.log({ userId: user.id, action: 'cliente.eliminado_lgpd', entity: 'Client', entityId: id });
    return { ok: true };
  }

  @Post('clients/:id/processes')
  async link(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { processId?: string; number?: string; targetId?: string; role?: string; notes?: string }) {
    const link = await this.clients.link(id, body);
    await this.audit.log({ userId: user.id, action: 'cliente.processo_vinculado', entity: 'Client', entityId: id, details: { processId: link.processId, role: link.role } });
    // Número novo: consulta o DataJud em segundo plano.
    const process = await this.prisma.process.findUnique({ where: { id: link.processId } });
    if (process?.source === 'manual') this.monitoring.enqueue(process.targetId);
    return this.clients.get(id);
  }

  @Delete('clients/:id/processes/:linkId')
  async unlink(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('linkId') linkId: string) {
    await this.clients.unlink(id, linkId);
    await this.audit.log({ userId: user.id, action: 'cliente.processo_desvinculado', entity: 'Client', entityId: id });
    return this.clients.get(id);
  }

  /** Liga o cliente a uma pessoa/empresa já monitorada (cadastro a partir de um alerta). */
  @Roles('admin', 'analista') @Post('clients/:id/link-target')
  async linkTarget(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { targetId: string }) {
    await this.clients.linkTarget(id, body?.targetId);
    await this.audit.log({ userId: user.id, action: 'cliente.monitoramento_vinculado', entity: 'Client', entityId: id, details: { targetId: body?.targetId } });
    return this.clients.get(id);
  }

  /** Monitora o cliente (rotina do cliente): cria/atualiza o perfil, roda a verificação e vincula tudo ao cliente. */
  @Post('clients/:id/monitor')
  async monitor(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { intervalMinutes?: number; purpose?: string; processNumbers?: string[]; oab?: string } = {}) {
    const existed = !!(await this.prisma.client.findUnique({ where: { id }, select: { targetId: true } }))?.targetId;
    const targetId = await this.clients.ensureTarget(id, true, body || {});
    await this.audit.log({ userId: user.id, action: 'cliente.monitoramento_ativado', entity: 'Client', entityId: id, details: { intervalo: body?.intervalMinutes, processos: body?.processNumbers?.length || 0 } });
    const result = await this.monitoring.check(targetId, { initial: !existed });
    await this.clients.ensureTarget(id, true); // vincula também o que acabou de ser encontrado
    return { targetId, result };
  }

  @Get('processes')
  processes(@Query('q') q = '') {
    return this.clients.searchProcesses(q);
  }

  @Get('cep/:cep')
  cep(@Param('cep') cep: string) {
    return this.clients.cep(cep);
  }
}
