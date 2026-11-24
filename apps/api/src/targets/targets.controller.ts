import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../auth/decorators';
import { maskDocument, onlyDigits } from '../common/documents';
import { ConnectorsService } from '../connectors/connectors.service';
import { SearchQuery } from '../connectors/types';
import { MonitoringService } from '../monitoring/monitoring.service';
import { AuditService } from '../system/audit.service';
import { INTERVALS, TargetInput, TargetsService } from './targets.service';
import { BadRequestException } from '@nestjs/common';
import { isValidCnpj, isValidCpf } from '../common/documents';
import { HttpException } from '@nestjs/common';
import { lookupCnpj } from '../connectors/brasilapi.connector';

@Controller('api')
export class TargetsController {
  constructor(
    private targets: TargetsService,
    private monitoring: MonitoringService,
    private connectors: ConnectorsService,
    private audit: AuditService,
  ) {}

  /** Dados públicos de um CNPJ (BrasilAPI + CNPJá) para preencher pesquisas e cadastros. */
  @Get('cnpj/:cnpj')
  async cnpj(@Param('cnpj') cnpj: string) {
    try { return await lookupCnpj(cnpj); }
    catch (e: any) { throw new HttpException(e.status === 404 || e.status === 400 ? e.message : 'As APIs de CNPJ não responderam agora. Tente de novo em instantes.', e.status === 404 || e.status === 400 ? e.status : 503); }
  }

  /** Pesquisa avulsa em todas as fontes (não grava nada além da auditoria). */
  @Post('search')
  async search(@CurrentUser() user: AuthUser, @Body() body: SearchQuery & { sources?: string[] }, @Ip() ip: string) {
    if (body.cpf && !isValidCpf(body.cpf)) throw new BadRequestException('CPF inválido.');
    if (body.cnpj && !isValidCnpj(body.cnpj)) throw new BadRequestException('CNPJ inválido.');
    if (!body.name && !body.cpf && !body.cnpj && !body.processNumbers?.length)
      throw new BadRequestException('Informe nome, documento ou número de processo.');
    const results = await this.connectors.run(body, body.sources);
    await this.audit.log({
      userId: user.id, action: 'pesquisa.executada', ip,
      details: { kind: body.kind, name: body.name, documento: body.cpf || body.cnpj ? maskDocument(onlyDigits(body.cpf || body.cnpj)) : undefined, processos: body.processNumbers?.length || 0 },
    });
    return { query: { ...body, cpf: body.cpf ? maskDocument(body.cpf) : undefined }, results };
  }

  @Get('connectors')
  connectorsList() {
    return this.connectors.list();
  }

  @Get('sources/catalog')
  catalog() {
    return this.connectors.catalog();
  }

  @Get('targets')
  list(@Query() q: { kind?: string; monitored?: string; q?: string }) {
    return this.targets.list(q);
  }

  @Get('targets/intervals')
  intervals() {
    return INTERVALS;
  }

  @Post('targets')
  async create(@CurrentUser() user: AuthUser, @Body() body: TargetInput) {
    const target = await this.targets.create(body);
    await this.audit.log({ userId: user.id, action: 'alvo.criado', entity: 'Target', entityId: target.id, details: { kind: target.kind, monitored: target.monitored, finalidade: body.purpose } });
    const result = await this.monitoring.check(target.id, { initial: true });
    return { id: target.id, result };
  }

  @Get('targets/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('reveal') reveal?: string) {
    const show = reveal === 'true' && user.role !== 'leitor';
    if (show) await this.audit.log({ userId: user.id, action: 'dados_sensiveis.visualizados', entity: 'Target', entityId: id });
    return this.targets.get(id, show);
  }

  @Patch('targets/:id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<TargetInput>) {
    await this.targets.update(id, body);
    await this.audit.log({ userId: user.id, action: 'alvo.alterado', entity: 'Target', entityId: id, details: body });
    return this.targets.get(id);
  }

  @Roles('admin', 'analista') @Delete('targets/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.targets.remove(id);
    await this.audit.log({ userId: user.id, action: 'alvo.eliminado_lgpd', entity: 'Target', entityId: id });
    return { ok: true };
  }

  @Post('targets/:id/check')
  async check(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.audit.log({ userId: user.id, action: 'monitoramento.verificacao_manual', entity: 'Target', entityId: id });
    return this.monitoring.check(id, { initial: false, full: true });
  }

  @Post('targets/:id/processes')
  async attach(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { number: string }) {
    await this.targets.attachNumber(id, body.number);
    await this.audit.log({ userId: user.id, action: 'processo.vinculado', entity: 'Target', entityId: id, details: { numero: body.number } });
    return this.monitoring.check(id, { initial: false });
  }

  @Get('processes/:id')
  process(@Param('id') id: string) {
    return this.targets.getProcess(id);
  }
}
