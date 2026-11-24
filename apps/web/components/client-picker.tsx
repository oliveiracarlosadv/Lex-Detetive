'use client';
import { useEffect, useState } from 'react';
import { Contact, Search, X } from 'lucide-react';
import { api } from '@/lib/api';

export interface PickedClient { id: string; name: string; kind: 'PF' | 'PJ' }

/** Seleciona um cliente já cadastrado para vincular a pesquisa à rotina dele. */
export function ClientPicker({ value, onChange, selectedLabel = 'Pesquisa vinculada ao cliente', placeholder = 'Buscar cliente para preencher e vincular' }: {
  value: PickedClient | null; onChange: (c: PickedClient | null) => void; selectedLabel?: string; placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => api<any[]>(`/clients?q=${encodeURIComponent(q)}`).then((r) => setList(r.slice(0, 8))).catch(() => setList([])), 150);
    return () => clearTimeout(t);
  }, [q, open]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
        <Contact className="size-4 text-primary" />
        <div className="min-w-0 flex-1"><div className="text-[11px] text-muted-foreground">{selectedLabel}</div><div className="truncate font-medium">{value.name}</div></div>
        <button type="button" onClick={() => onChange(null)} className="rounded p-1 hover:bg-muted cursor-pointer" aria-label="Desvincular cliente"><X className="size-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Cliente cadastrado (opcional)</span>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            className="flex h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        </div>
      </label>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl">
          {list.map((c) => (
            <li key={c.id}><button type="button" onMouseDown={(e) => { e.preventDefault(); onChange({ id: c.id, name: c.name, kind: c.kind }); setOpen(false); setQ(''); }}
              className="w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted cursor-pointer">
              <div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.kind === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}{c.document ? ` · ${c.document}` : ''} · {c.processCount} processo(s)</div>
            </button></li>
          ))}
          {!list.length && <li className="px-3 py-3 text-center text-xs text-muted-foreground">Nenhum cliente encontrado.</li>}
        </ul>
      )}
    </div>
  );
}
