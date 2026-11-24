import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MonitoringService } from '../monitoring/monitoring.service';
import { PrismaService } from '../prisma.service';

@Controller('api')
export class DashboardController {
  constructor(private prisma: PrismaService, private monitoring: MonitoringService) {}

  @Get('dashboard')
  async dashboard() {
    const since30 = new Date(Date.now() - 30 * 86400000);
    const since7 = new Date(Date.now() - 7 * 86400000);
    const [pf, pj, pfMon, pjMon, processes, active, movements7, unread, recent, alerts, byCourt, movs30] = await Promise.all([
      this.prisma.target.count({ where: { kind: 'PF' } }),
      this.prisma.target.count({ where: { kind: 'PJ' } }),
      this.prisma.target.count({ where: { kind: 'PF', monitored: true } }),
      this.prisma.target.count({ where: { kind: 'PJ', monitored: true } }),
      this.prisma.process.count(),
      this.prisma.process.count({ where: { status: 'ativo' } }),
      this.prisma.movement.count({ where: { date: { gte: since7 } } }),
      this.prisma.alert.count({ where: { read: false } }),
      this.prisma.movement.findMany({
        orderBy: { date: 'desc' }, take: 15,
        include: { process: { select: { id: true, number: true, court: true, target: { select: { id: true, name: true } } } } },
      }),
      this.prisma.alert.findMany({ where: { read: false }, orderBy: { createdAt: 'desc' }, take: 8, include: { target: { select: { name: true } } } }),
      this.prisma.process.groupBy({ by: ['court'], _count: { _all: true }, orderBy: { _count: { court: 'desc' } }, take: 8 }),
      this.prisma.movement.findMany({ where: { date: { gte: since30 } }, select: { date: true } }),
    ]);
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) days[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = 0;
    for (const m of movs30) {
      const k = m.date.toISOString().slice(0, 10);
      if (k in days) days[k]++;
    }
    return {
      kpis: { pessoas: pf, empresas: pj, pessoasMonitoradas: pfMon, empresasMonitoradas: pjMon, processos: processes, processosAtivos: active, movimentacoes7d: movements7, alertasNaoLidos: unread },
      movementsByDay: Object.entries(days).map(([date, count]) => ({ date, count })),
      byCourt: byCourt.filter((c) => c.court !== '—').map((c) => ({ court: c.court, count: c._count._all })),
      recentMovements: recent,
      alerts,
      queue: this.monitoring.status(),
    };
  }

  /** Contador leve para o menu (consultado periodicamente; evita recalcular o painel inteiro). */
  @Get('alerts/unread-count')
  async unreadCount() {
    return { unread: await this.prisma.alert.count({ where: { read: false } }) };
  }

  @Get('alerts')
  alerts(@Query('unread') unread?: string, @Query('targetId') targetId?: string, @Query('limit') limit?: string) {
    return this.prisma.alert.findMany({
      where: { read: unread === 'true' ? false : undefined, targetId: targetId || undefined },
      orderBy: { createdAt: 'desc' },
      take: Math.min(300, Math.max(1, Number(limit) || 300)),
      include: { target: { select: { id: true, name: true } } },
    });
  }

  @Post('alerts/:id/read')
  async read(@Param('id') id: string) {
    await this.prisma.alert.update({ where: { id }, data: { read: true } });
    return { ok: true };
  }

  @Post('alerts/read-all')
  async readAll() {
    const r = await this.prisma.alert.updateMany({ where: { read: false }, data: { read: true } });
    return { updated: r.count };
  }
}
