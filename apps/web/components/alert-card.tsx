'use client';
import Link from 'next/link';
import { AlertTriangle, Bell, UserPlus, Building, CalendarClock, CalendarCheck, Check, FileWarning, Gavel, Scale, Sparkles, X } from 'lucide-react';
import { Badge } from './ui/badge';
import { fmtDate, fmtDateTime, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LinkToClientButton } from './link-to-client';

export const ALERT_LABEL: Record<string, string> = {
  intimacao: 'Intimação', movimentacao: 'Movimentação', novo_processo: 'Novo processo', baixa: 'Baixa',
  alteracao_cadastral: 'Alteração cadastral', sancao: 'Sanção', publicacao: 'Diário oficial', pesquisa_inicial: 'Pesquisa inicial', erro_fonte: 'Erro de fonte',
};
const toneOf = (sev: string) => (sev === 'critico' ? 'red' : sev === 'atencao' ? 'gold' : 'blue') as 'red' | 'gold' | 'blue';

/** Ficha do processo exibida nos alertas e na página do processo. */
export function ProcessCardView({ card, compact }: { card: any; compact?: boolean }) {
  const marco = (label: string, m: any) => (
    <div className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs', m?.presente ? 'border-success/30 bg-success/5' : 'border-border text-muted-foreground')}
      title={m?.descricao || 'Não consta nas movimentações disponíveis'}>
      {m?.presente ? <Check className="size-3.5 text-success" /> : <X className="size-3.5" />}
      {label}{m?.presente && <span className="text-muted-foreground">· {fmtDate(m.data)}</span>}
    </div>
  );
  const rows: [string, string][] = [['Processo', card.processo], ['Tribunal', card.tribunal], ['Vara', card.vara], ['Autor', card.autor], ['Réu', card.reu], ['Valor da causa', card.valorCausa]];
  return (
    // Layout pela largura do próprio cartão (@container): na coluna estreita do painel os campos ficam empilhados.
    <div className="@container space-y-3">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm @xl:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2"><dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground pt-0.5">{k}</dt><dd className="min-w-0 break-words font-medium">{v}</dd></div>
        ))}
      </dl>
      {card.resumoIA && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#8a6d10] dark:text-gold"><Sparkles className="size-3.5" />Resumo Lex AI <span className="font-normal text-muted-foreground">({card.resumoFonte === 'regras' ? 'por regras' : card.resumoFonte})</span></div>
          <p className="leading-relaxed">{card.resumoIA}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {marco('Liminar', card.marcos?.liminar)}{marco('Contestação', card.marcos?.contestacao)}{marco('Réplica', card.marcos?.replica)}{marco('Sentença', card.marcos?.sentenca)}
      </div>
      <div className={cn('grid gap-3', compact ? '@md:grid-cols-2' : '@3xl:grid-cols-3')}>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium"><CalendarClock className="size-3.5 text-primary" />Audiências marcadas</div>
          {card.audienciasMarcadas?.length ? card.audienciasMarcadas.slice(0, 4).map((a: any, i: number) => (
            <div key={i} className="text-xs"><span className={cn('font-medium', new Date(a.data) > new Date() && 'text-primary')}>{fmtDateTime(a.data)}</span> <span className="text-muted-foreground">— {a.descricao}</span></div>
          )) : <div className="text-xs text-muted-foreground">Nenhuma</div>}
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium"><CalendarCheck className="size-3.5 text-success" />Audiências realizadas</div>
          {card.audienciasRealizadas?.length ? card.audienciasRealizadas.slice(0, 4).map((a: any, i: number) => (
            <div key={i} className="text-xs"><span className="font-medium">{fmtDate(a.data)}</span> <span className="text-muted-foreground">— {a.descricao}</span></div>
          )) : <div className="text-xs text-muted-foreground">Nenhuma</div>}
        </div>
        {!compact && (
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium"><Scale className="size-3.5" />Últimas movimentações</div>
            {card.ultimasMovimentacoes?.map((m: any, i: number) => (
              <div key={i} className="text-xs"><span className="font-medium">{fmtDate(m.data)}</span> <span className="text-muted-foreground">— {m.descricao}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AlertCard({ alert, onRead, onRegisterClient }: { alert: any; onRead?: (id: string) => void; onRegisterClient?: (alert: any) => void }) {
  const card = alert.data ? (() => { try { return JSON.parse(alert.data); } catch { return null; } })() : null;
  const Icon = alert.type === 'intimacao' ? Gavel : alert.type === 'sancao' ? AlertTriangle : alert.type === 'alteracao_cadastral' ? Building : alert.type === 'novo_processo' ? FileWarning : Bell;
  return (
    <div className={cn('rounded-xl border bg-card p-4', alert.read ? 'border-border' : alert.severity === 'critico' ? 'border-danger/40' : 'border-primary/30')}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 rounded-lg p-2', alert.severity === 'critico' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary')}><Icon className="size-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={toneOf(alert.severity)}>{ALERT_LABEL[alert.type] || alert.type}</Badge>
            {!alert.read && <span className="size-1.5 rounded-full bg-gold" aria-label="não lido" />}
            <span className="text-xs text-muted-foreground" title={fmtDateTime(alert.createdAt)}>{timeAgo(alert.createdAt)}</span>
            {alert.target && <Link href={`/alvo/?id=${alert.target.id}`} className="text-xs text-muted-foreground hover:underline">· {alert.target.name}</Link>}
          </div>
          <p className="mt-1 text-sm font-medium">{alert.title}</p>
          <p className="line-clamp-4 text-sm text-muted-foreground" title={alert.message}>{alert.message}</p>
          {card && <div className="mt-3 border-t border-border pt-3"><ProcessCardView card={card} compact /></div>}
          {card && !card.resumoIA && <p className="mt-2 text-xs text-muted-foreground"><Sparkles className="mr-1 inline size-3" />Lex AI preparando resumo…</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {alert.processId && <Link href={`/processo/?id=${alert.processId}`} className="text-xs font-medium text-primary hover:underline">Abrir processo</Link>}
            {(alert.processId || alert.targetId) && <LinkToClientButton processId={alert.processId || undefined} targetId={alert.targetId || undefined} variant="link" />}
            {onRegisterClient && (alert.target || alert.processId) && (
              <button onClick={() => onRegisterClient(alert)} className="text-xs font-medium text-primary hover:underline cursor-pointer"><UserPlus className="mr-1 inline size-3" />Cadastrar como cliente</button>
            )}
            {!alert.read && onRead && <button onClick={() => onRead(alert.id)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Marcar como lido</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
