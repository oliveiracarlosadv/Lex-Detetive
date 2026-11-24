import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../system/settings.service';
import { brasilApiConnector } from './brasilapi.connector';
import { SOURCE_CATALOG } from './catalog';
import { datajudConnector } from './datajud.connector';
import { djenConnector } from './djen.connector';
import { douConnector } from './dou.connector';
import { queridoDiarioConnector } from './diarios.connector';
import { transparenciaConnector } from './transparencia.connector';
import { socialConnector } from './social.connector';
import { webSearchConnector } from './websearch.connector';
import { doeConnector } from './doe.connector';
import { Connector, ConnectorContext, ConnectorResult, SearchQuery } from './types';

@Injectable()
export class ConnectorsService {
  private readonly logger = new Logger('Conectores');
  /** O DJEN vem primeiro: é a fonte principal da busca por nome, OAB e número. */
  readonly connectors: Connector[] = [djenConnector, datajudConnector, brasilApiConnector, transparenciaConnector, douConnector, doeConnector, queridoDiarioConnector, socialConnector, webSearchConnector];

  constructor(private settings: SettingsService) {}

  private get ctx(): ConnectorContext {
    return { setting: (k) => this.settings.get(k) };
  }

  async list() {
    return Promise.all(
      this.connectors.map(async (c) => ({
        id: c.id, name: c.name, category: c.category, description: c.description,
        capabilities: c.capabilities, website: c.website, requiresSetting: c.requiresSetting,
        ...(await c.isEnabled(this.ctx)),
      })),
    );
  }

  catalog() {
    return SOURCE_CATALOG;
  }

  /** Executa as fontes aplicáveis em paralelo; uma fonte com erro não derruba as demais. */
  /** Fonte instável ou limitando consultas (HTTP 429/5xx, sem rede): fica em pausa por um tempo. */
  private pausedUntil = new Map<string, { until: number; reason: string }>();

  private pause(id: string, e: any) {
    const status = Number(e?.status) || 0;
    const minutes = status === 429 ? 15 : status >= 500 ? 10 : 5;
    const reason = status === 429 ? 'limite de consultas da fonte atingido' : status >= 500 ? 'fonte fora do ar' : 'fonte indisponível ou sem internet';
    this.pausedUntil.set(id, { until: Date.now() + minutes * 60_000, reason });
  }

  async run(q: SearchQuery, only?: string[], opts: { background?: boolean } = {}): Promise<ConnectorResult[]> {
    const selected = this.connectors.filter((c) => !only?.length || only.includes(c.id));
    return Promise.all(
      selected.map(async (c): Promise<ConnectorResult> => {
        const base = { connectorId: c.id, connectorName: c.name, processes: [] };
        const status = await c.isEnabled(this.ctx);
        if (!status.enabled) return { ...base, ok: false, skipped: true, message: status.reason };
        if (!c.appliesTo(q)) return { ...base, ok: true, skipped: true, message: 'Não se aplica aos dados informados.' };
        // Em pausa: o monitoramento automático pula a fonte; a pesquisa manual só pula se for limite de consultas.
        const p = this.pausedUntil.get(c.id);
        if (p && p.until > Date.now() && (opts.background || p.reason.startsWith('limite'))) {
          const at = new Date(p.until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return { ...base, ok: false, skipped: true, message: `Em pausa até ${at} (${p.reason}).` };
        }
        const started = Date.now();
        try {
          const r = await c.search(q, this.ctx);
          return { ...base, ...r, durationMs: Date.now() - started };
        } catch (e) {
          const offline = /fetch failed|ENOTFOUND|EAI_AGAIN|timeout|aborted/i.test(String(e?.message || e) + String(e?.cause?.code || ''));
          this.logger.warn(`${c.id}: ${String(e.message).split('\n')[0].slice(0, 160)}`);
          const status = Number(e?.status) || 0;
          if (offline || status === 429 || status >= 500) this.pause(c.id, e);
          return { ...base, ok: false, message: offline ? 'Fonte indisponível ou sem internet.' : e.message, durationMs: Date.now() - started };
        }
      }),
    );
  }
}
