import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AiService } from '../ai/ai.service';
import { LOW_END } from '../common/hardware';
import { ConnectorsService } from '../connectors/connectors.service';
import { PrismaService } from '../prisma.service';
import { SettingsService } from '../system/settings.service';
import { summarizeResults } from '../targets/ingest';
import { IngestSummary, TargetsService } from '../targets/targets.service';

/**
 * Fila de monitoramento em processo (modo local). No modo SaaS, esta fila é
 * substituída por BullMQ + Redis mantendo a mesma interface (enqueue/check).
 */
@Injectable()
export class MonitoringService {
  private readonly logger = new Logger('Monitoramento');
  private queue: string[] = [];
  private running = new Set<string>();
  /** Computadores com até 6 GB de RAM ou até 4 núcleos lógicos (ex.: Intel i3) verificam uma pessoa/empresa por vez. */
  /** Uma verificação automática por vez (leve para qualquer computador). */
  private readonly concurrency = 1;
  /** Ao abrir o app, as verificações atrasadas esperam 2 minutos (a tela abre primeiro). */
  private readonly bootAt = Date.now();

  constructor(
    private prisma: PrismaService,
    private connectors: ConnectorsService,
    private targets: TargetsService,
    private settings: SettingsService,
    private ai: AiService,
  ) {}

  /** Fila de resumos de IA (um por vez, para não sobrecarregar o modelo local). */
  private summaries: string[] = [];
  private summarizing = false;

  private enqueueSummaries(ids: string[]) {
    this.summaries.push(...ids);
    if (this.summarizing) return;
    this.summarizing = true;
    (async () => {
      while (this.summaries.length) {
        const id = this.summaries.shift()!;
        await this.ai.summarizeAlert(id).catch((e) => this.logger.warn(`Resumo IA falhou: ${e.message}`));
      }
      this.summarizing = false;
    })();
  }

  status() {
    return { queued: this.queue.length, running: this.running.size, summaries: this.summaries.length };
  }

  @Interval(30_000)
  async tick() {
    if (Date.now() - this.bootAt < 120_000) return;
    if (!(await this.settings.getBool('monitor.enabled'))) return;
    const due = await this.prisma.target.findMany({
      where: { monitored: true, OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: new Date() } }] },
      select: { id: true },
      orderBy: { nextCheckAt: 'asc' },
      take: 20,
    });
    due.forEach((t) => this.enqueue(t.id));
  }

  enqueue(id: string) {
    if (this.running.has(id) || this.queue.includes(id)) return;
    this.queue.push(id);
    this.drain();
  }

  private drain() {
    while (this.running.size < this.concurrency && this.queue.length) {
      const id = this.queue.shift()!;
      this.running.add(id);
      this.check(id, { initial: false })
        .catch((e) => this.logger.error(`Falha ao verificar ${id}: ${e.message}`))
        .finally(() => {
          this.running.delete(id);
          setTimeout(() => this.drain(), 8000); // pausa entre verificações: sem picos de processamento
        });
    }
  }

  /** Consulta todas as fontes aplicáveis e registra novidades. */
  async check(id: string, opts: { initial: boolean; full?: boolean }): Promise<IngestSummary & { sources: ReturnType<typeof summarizeResults> }> {
    const target = await this.prisma.target.findUnique({ where: { id } });
    if (!target) return { newProcesses: 0, newMovements: 0, alerts: 0, registryChanges: 0, newRecords: 0, intimacoes: 0, summarize: [], sources: [] };
    const query = await this.targets.buildQuery(id);
    // Verificação manual (full) refaz o período completo — inclusive a conferência de CPF nos processos antigos.
    if (!opts.initial && !opts.full && target.lastCheckedAt) query.incremental = true;
    const results = await this.connectors.run(query, undefined, { background: !opts.initial && !opts.full });
    const summary = await this.targets.ingest(id, results, opts);
    const sources = summarizeResults(results);
    if (summary.summarize.length) this.enqueueSummaries(summary.summarize);
    const now = new Date();
    await this.prisma.target.update({
      where: { id },
      data: {
        lastCheckedAt: now,
        nextCheckAt: target.monitored ? new Date(now.getTime() + target.intervalMinutes * 60_000) : null,
        lastCheckSummary: JSON.stringify({ at: now, summary, sources }),
      },
    });
    this.logger.log(`${target.name}: +${summary.newProcesses} processos, +${summary.newMovements} movimentações, ${summary.alerts} alertas`);
    return { ...summary, sources };
  }
}
