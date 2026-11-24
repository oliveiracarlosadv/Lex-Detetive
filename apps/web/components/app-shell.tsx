'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Bell, Building2, Contact, FileText, Gauge, Library, Lock, Menu, Moon, Radar, ScrollText,
  Search, Settings, Sun, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useApi } from '@/lib/use-api';
import { Wordmark } from './logo';
import { CommandPalette } from './command-palette';
import { NotificationBell } from './notification-bell';
import { InstallButton } from './install-app';
import { firstLast, initials } from '@/lib/image';

export const NAV = [
  { href: '/', label: 'Painel', icon: Gauge },
  { href: '/pesquisa/', label: 'Pesquisa', icon: Search },
  { href: '/monitoramento/', label: 'Monitoramento', icon: Radar },
  { href: '/clientes/', label: 'Clientes', icon: Contact },
  { href: '/alertas/', label: 'Alertas', icon: Bell, badge: true },
  { href: '/relatorios/', label: 'Relatórios', icon: FileText },
  { href: '/fontes/', label: 'Fontes', icon: Library },
  { href: '/auditoria/', label: 'Auditoria', icon: ScrollText, admin: true },
  { href: '/configuracoes/', label: 'Configurações', icon: Settings },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  return (
    <button onClick={() => setTheme(dark ? 'light' : 'dark')} className="rounded-lg p-2 text-muted-foreground hover:bg-muted cursor-pointer" aria-label={dark ? 'Modo claro' : 'Modo escuro'}>
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut, hasPassword } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const { data: alerts, reload } = useApi<{ unread: number }>(user ? '/alerts/unread-count' : null);

  useEffect(() => { setOpen(false); reload(true); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Contador de novidades: a cada 60 s com a janela visível; minimizada, a cada 5 min (poupa processador
    // e ainda permite a notificação do sistema).
    let tick = 0;
    const t = setInterval(() => { tick++; if (!document.hidden || tick % 5 === 0) reload(true); }, 60000);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => { clearInterval(t); window.removeEventListener('keydown', onKey); };
  }, [reload]);

  const items = useMemo(() => NAV.filter((n) => !n.admin || user?.role === 'admin'), [user]);
  const unread = alerts?.unread || 0;
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href.replace(/\/$/, '')));

  const sidebar = (
    <nav className="flex h-full flex-col bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-sidebar-foreground">
      <div className="flex h-16 items-center justify-between px-4"><Wordmark light />
        <button className="lg:hidden rounded p-1 hover:bg-white/10 cursor-pointer" onClick={() => setOpen(false)} aria-label="Fechar menu"><X className="size-5" /></button>
      </div>
      <div className="px-3 pb-2">
        <InstallButton />
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {items.map((n) => (
          <Link key={n.href} href={n.href}
            className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive(n.href) ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 hover:text-white')}>
            <n.icon className={cn('size-4', isActive(n.href) && 'text-gold')} />
            <span className="flex-1">{n.label}</span>
            {n.badge && unread > 0 && <span className="rounded-full bg-gold px-1.5 text-[10px] font-semibold text-navy">{unread > 99 ? '99+' : unread}</span>}
          </Link>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Link href="/configuracoes/" className="flex min-w-0 flex-1 items-center gap-3" title="Meu perfil">
            {user?.photo
              ? <img src={user.photo} alt="" className="size-9 shrink-0 rounded-full object-cover ring-2 ring-gold/60" />
              : <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">{initials(user?.name)}</div>}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{firstLast(user?.name)}</div>
              <div className="truncate text-[11px]">{user?.office || 'Meu perfil'}</div>
            </div>
          </Link>
          {hasPassword && <button onClick={signOut} className="rounded p-1.5 hover:bg-white/10 cursor-pointer" aria-label="Bloquear" title="Bloquear"><Lock className="size-4" /></button>}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-64" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3 border-b border-border bg-background px-4 pt-[env(safe-area-inset-top)] lg:px-8">
        <button className="lg:hidden rounded-lg p-2 hover:bg-muted cursor-pointer" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu className="size-5" /></button>
        <button onClick={() => setPalette(true)}
          className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground hover:border-input cursor-pointer">
          <Search className="size-4 shrink-0" /><span className="flex-1 truncate text-left"><span className="sm:hidden">Buscar…</span><span className="hidden sm:inline">Buscar pessoas, empresas, clientes, processos…</span></span>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 text-[10px] sm:inline">⌘K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell unread={unread} onChange={() => reload(true)} />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:px-8">{children}</main>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

export { Building2 };
