'use client';
import { getSetting } from '../settings';
import { brasilApiConnector } from './brasilapi.connector';
import { SOURCE_CATALOG } from './catalog';
import { djenConnector } from './djen.connector';
import { douConnector } from './dou.connector';
import { queridoDiarioConnector } from './diarios.connector';
import { transparenciaConnector } from './transparencia.connector';
import { socialConnector } from './social.connector';
import { webSearchConnector } from './websearch.connector';
import { doeConnector } from './doe.connector';
import { Connector, ConnectorContext, ConnectorResult, SearchQuery } from './types';

/** O DJEN vem primeiro: é a fonte principal da busca por nome, OAB e número. */
export const CONNECTORS: Connector[] = [djenConnector, brasilApiConnector, transparenciaConnector, douConnector, doeConnector, queridoDiarioConnector, socialConnector, webSearchConnector];

const ctx: ConnectorContext = { setting: (k) => getSetting(k) };

export async function listConnectors() {
  return Promise.all(CONNECTORS.map(async (c) => ({
    id: c.id, name: c.name, category: c.category, description: c.description,
    capabilities: c.capabilities, website: c.website, requiresSetting: c.requiresSetting,
    ...(await c.isEnabled(ctx)),
  })));
}

export const catalog = () => SOURCE_CATALOG;

/** Fonte instável ou limitando consultas (HTTP 429/5xx, sem rede): fica em pausa por um tempo. */
const pausedUntil = new Map<string, { until: number; reason: string }>();
function pause(id: string, e: any) {
  const status = Number(e?.status) || 0;
  const minutes = status === 429 ? 15 : status >= 500 ? 10 : 5;
  const reason = status === 429 ? 'limite de consultas da fonte atingido' : status >= 500 ? 'fonte fora do ar' : 'fonte indisponível ou sem internet';
  pausedUntil.set(id, { until: Date.now() + minutes * 60_000, reason });
}

/** Executa as fontes aplicáveis em paralelo; uma fonte com erro não derruba as demais. */
export async function runConnectors(q: SearchQuery, only?: string[], opts: { background?: boolean } = {}): Promise<ConnectorResult[]> {
  const selected = CONNECTORS.filter((c) => !only?.length || only.includes(c.id));
  return Promise.all(selected.map(async (c): Promise<ConnectorResult> => {
    const base = { connectorId: c.id, connectorName: c.name, processes: [] };
    const status = await c.isEnabled(ctx);
    if (!status.enabled) return { ...base, ok: false, skipped: true, message: status.reason };
    if (!c.appliesTo(q)) return { ...base, ok: true, skipped: true, message: 'Não se aplica aos dados informados.' };
    const p = pausedUntil.get(c.id);
    if (p && p.until > Date.now() && (opts.background || p.reason.startsWith('limite'))) {
      const at = new Date(p.until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return { ...base, ok: false, skipped: true, message: `Em pausa até ${at} (${p.reason}).` };
    }
    const started = Date.now();
    try {
      const r = await c.search(q, ctx);
      return { ...base, ...r, durationMs: Date.now() - started };
    } catch (e: any) {
      const offline = /fetch failed|tempo esgotado|ENOTFOUND|timeout|aborted|Failed to fetch|NetworkError/i.test(String(e?.message || e));
      const st = Number(e?.status) || 0;
      if (offline || st === 429 || st >= 500) pause(c.id, e);
      return { ...base, ok: false, message: offline ? 'Fonte indisponível ou sem internet.' : e.message, durationMs: Date.now() - started };
    }
  }));
}
