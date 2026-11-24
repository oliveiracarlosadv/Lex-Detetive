'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Bell, BellRing, Building, CheckCheck, FileWarning, Gavel, Scale } from 'lucide-react';
import { api } from '@/lib/api';
import { timeAgo, fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ALERT_LABEL } from './alert-card';

const ICON: Record<string, React.ElementType> = { intimacao: Gavel, sancao: AlertTriangle, alteracao_cadastral: Building, novo_processo: FileWarning, movimentacao: Scale };
const processOf = (a: any) => { try { return a.data ? JSON.parse(a.data)?.processo : null; } catch { return null; } };

/**
 * Sino da barra superior: mostra quantas novidades (movimentações, intimações, novos
 * processos) ainda não foram lidas e abre a lista das mais recentes.
 */
export function NotificationBell({ unread, onChange }: { unread: number; onChange: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);

  const load = () => api<any[]>('/alerts?unread=true&limit=15').then(setItems).catch(() => setItems([]));

  // Chegou novidade enquanto o app estava aberto: aviso na tela e notificação do sistema.
  useEffect(() => {
    if (last.current !== null && unread > last.current) {
      const n = unread - last.current;
      const msg = n === 1 ? '1 nova movimentação ou intimação' : `${n} novas movimentações ou intimações`;
      toast.info(msg, { action: { label: 'Ver', onClick: () => setOpen(true) } });
      try {
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Lex Detetive', { body: msg });
      } catch { /* sem suporte */ }
      if (open) load();
    }
    last.current = unread;
  }, [unread]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    load();
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* sem suporte */ }
    const outside = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', esc); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAlert = async (a: any) => {
    setOpen(false);
    api(`/alerts/${a.id}/read`, { method: 'POST' }).then(onChange).catch(() => undefined);
    router.push(a.processId ? `/processo/?id=${a.processId}` : a.target ? `/alvo/?id=${a.target.id}` : '/alertas/');
  };
  const readAll = async () => {
    await api('/alerts/read-all', { method: 'POST' }).catch((e) => toast.error(e.message));
    setItems([]);
    onChange();
  };

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen((o) => !o)} className={cn('relative rounded-lg p-2 hover:bg-muted cursor-pointer', unread ? 'text-foreground' : 'text-muted-foreground')}
        aria-label={unread ? `${unread} novidade(s) não lida(s)` : 'Notificações'} aria-expanded={open} title="Novas movimentações e intimações">
        {unread ? <BellRing className="size-4" /> : <Bell className="size-4" />}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold leading-none text-navy">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,400px)] overflow-hidden rounded-xl border border-border bg-card shadow-lg" role="dialog" aria-label="Notificações">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Notificações</div>
              <div className="text-xs text-muted-foreground">{unread ? `${unread} não lida(s)` : 'Tudo em dia'}</div>
            </div>
            {unread > 0 && <button onClick={readAll} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"><CheckCheck className="size-3.5" />Marcar todas como lidas</button>}
          </div>
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {items === null && <li className="px-4 py-6 text-center text-xs text-muted-foreground">Carregando…</li>}
            {items?.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground"><Bell className="mx-auto mb-2 size-5 opacity-40" />Nenhuma movimentação nova.</li>
            )}
            {items?.map((a) => {
              const Icon = ICON[a.type] || Bell;
              const proc = processOf(a);
              return (
                <li key={a.id}>
                  <button onClick={() => openAlert(a)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-muted/60 cursor-pointer">
                    <span className={cn('mt-0.5 h-fit rounded-lg p-1.5', a.severity === 'critico' ? 'bg-danger/10 text-danger' : a.type === 'intimacao' ? 'bg-gold/15 text-[#8a6d10] dark:text-gold' : 'bg-primary/10 text-primary')}><Icon className="size-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-medium uppercase tracking-wide">{ALERT_LABEL[a.type] || a.type}</span>
                        <span title={fmtDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</span>
                      </span>
                      <span className="block truncate text-sm font-medium">{a.target?.name || a.title}</span>
                      {proc && <span className="block font-mono text-[11px] text-muted-foreground">{proc}</span>}
                      <span className="line-clamp-2 text-xs text-muted-foreground">{a.message || a.title}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Link href="/alertas/" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-muted/60">Ver todos os alertas</Link>
        </div>
      )}
    </div>
  );
}
