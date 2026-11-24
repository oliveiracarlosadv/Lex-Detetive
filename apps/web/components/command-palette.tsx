'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Contact, FileSearch, Search, User } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { NAV } from './app-shell';

interface Item { id: string; label: string; hint?: string; href: string; icon: React.ElementType }

/** Paleta de comandos estilo Raycast/Linear (⌘K). */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => input.current?.focus(), 10); } }, [open]);
  useEffect(() => {
    if (!open || q.trim().length < 2) { setRemote([]); return; }
    const t = setTimeout(async () => {
      const [targets, clients, procs] = await Promise.all([
        api<any[]>(`/targets?q=${encodeURIComponent(q)}`).catch(() => []),
        api<any[]>(`/clients?q=${encodeURIComponent(q)}`).catch(() => []),
        api<any[]>(`/processes?q=${encodeURIComponent(q)}`).catch(() => []),
      ]);
      setRemote([
        ...targets.slice(0, 5).map((t) => ({ id: t.id, label: t.name, hint: t.kind === 'PF' ? 'Monitorado · pessoa' : 'Monitorado · empresa', href: `/alvo/?id=${t.id}`, icon: t.kind === 'PF' ? User : Building2 })),
        ...clients.slice(0, 5).map((c) => ({ id: c.id, label: c.name, hint: 'Cliente', href: `/clientes/detalhe/?id=${c.id}`, icon: Contact })),
        ...procs.slice(0, 5).map((p) => ({ id: p.id, label: p.number, hint: `${p.court} · ${p.className || ''}`, href: `/processo/?id=${p.id}`, icon: FileSearch })),
      ]);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const items: Item[] = useMemo(() => {
    const nav = NAV.filter((n) => n.label.toLowerCase().includes(q.toLowerCase())).map((n) => ({ id: n.href, label: n.label, hint: 'Ir para', href: n.href, icon: n.icon }));
    const searchItem = q.trim().length >= 3 ? [{ id: 'search', label: `Pesquisar “${q}” nas fontes`, hint: 'Pesquisa', href: `/pesquisa/?q=${encodeURIComponent(q)}`, icon: Search }] : [];
    return [...remote, ...searchItem, ...nav];
  }, [q, remote]);

  if (!open) return null;
  const go = (it?: Item) => { if (!it) return; onClose(); router.push(it.href); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy/40 p-4 pt-[12vh]" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="Digite um nome, CPF/CNPJ, número de processo ou página…"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter') go(items[idx]);
              if (e.key === 'Escape') onClose();
            }} />
          <kbd className="rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground">esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {items.map((it, i) => (
            <li key={it.id + i}>
              <button onMouseEnter={() => setIdx(i)} onClick={() => go(it)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm cursor-pointer', i === idx && 'bg-muted')}>
                <it.icon className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{it.label}</span>
                {it.hint && <span className="text-xs text-muted-foreground">{it.hint}</span>}
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nada encontrado.</li>}
        </ul>
      </div>
    </div>
  );
}
