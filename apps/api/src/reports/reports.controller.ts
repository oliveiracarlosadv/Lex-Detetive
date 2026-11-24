import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { AuditService } from '../system/audit.service';
import { SettingsService } from '../system/settings.service';
import { TargetsService } from '../targets/targets.service';
import { PrismaService } from '../prisma.service';
import { exportReport, ExportFormat, FORMATS } from './exporters';
import { buildReport, reportAuthor, REPORT_TYPES, ReportType } from './report.builder';

@Controller('api/reports')
export class ReportsController {
  constructor(private targets: TargetsService, private prisma: PrismaService, private audit: AuditService, private settings: SettingsService) {}

  @Get('types')
  types() {
    return { types: REPORT_TYPES, formats: Object.keys(FORMATS) };
  }

  @Get('targets/:id')
  async report(
    @CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response,
    @Query('type') type: ReportType = 'sintetico', @Query('format') format: ExportFormat = 'pdf',
  ) {
    if (!REPORT_TYPES[type]) throw new BadRequestException('Tipo de relatório inválido.');
    if (!FORMATS[format]) throw new BadRequestException('Formato inválido.');
    const target: any = await this.targets.get(id);
    for (const p of target.processes) {
      p.movements = await this.prisma.movement.findMany({ where: { processId: p.id }, orderBy: { date: 'desc' } });
    }
    const report = buildReport(type, target, await reportAuthor(this.prisma, this.settings, user.id, user.name));
    const buffer = await exportReport(report, format);
    await this.audit.log({ userId: user.id, action: 'relatorio.gerado', entity: 'Target', entityId: id, details: { type, format, integridade: report.integrity } });
    const slug = target.name.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40);
    const file = `lex-detetive-${type}-${slug}-${new Date().toISOString().slice(0, 10)}.${FORMATS[format].ext}`;
    res.setHeader('Content-Type', FORMATS[format].mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.setHeader('X-Integrity-SHA256', report.integrity);
    res.send(buffer);
  }
}
