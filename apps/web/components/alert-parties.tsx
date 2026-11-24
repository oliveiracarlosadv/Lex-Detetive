'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, Filter, Search, UserCheck, UserPlus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/misc';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface AlertParty {
  name: string; polo: 'autor' | 'réu' | 'ambos'; alertIds: string[]; processIds: string[];
  client: { id: string; name: string; kind: 'PF' | 'PJ' } | null; linked: number;
}

/** Papel do cliente no processo conforme o polo em que o nome aparece. */
export const roleOf = (p: AlertParty) => (p.polo === 'autor' ? 'autor' : p.polo === 'réu' ? 'réu' : 'parte');
/** Palpite de pessoa jurídica pelo nome (para pré-preencher o cadastro). */
export const looksLikeCompany = (n: string) => /\b(LTDA|S\/?A|S\.A|EIRELI|EPP|ME|CIA|COMPANHIA|BANCO|ASSOCIA|SINDICATO|INSTITUTO|FUNDA[ÇC][ÃA]O|MINIST[ÉE]RIO|MUNIC[ÍI]PIO|ESTADO|UNI[ÃA]O|DELEGACIA|COOPERATIVA|CONDOM[ÍI]NIO|EMPRESA|SERVI[ÇC]OS|COM[ÉE]RCIO)\b/i.test(n);

/**
 * Lateral da tela de alertas: nomes de autor e réu encontrados nos alertas.
 * Clicar no nome filtra os alertas; se o nome já é cliente, pergunta se vincula (Sim/Não);
 * se não é, oferece cadastrar.
 */
export function AlertPartiesPanel({ parties, loading, selected, onSelect, onRegister, onLinked }: {
  parties: AlertParty[] | null; loading: boolean; selected: string | null;
  onSelect: (name: string | null) => void; onRegister: (p: AlertParty) => void; onLinked: () => void;
}) {
  const [q, setQ] = useState('');
  const [polo, setPolo] = useState<'todos' | 'autor' | 'réu'>('todos');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (parties || []).filter((p) => (!t || p.name.toLowerCase().includes(t)) && (polo === 'todos' || p.polo === polo || p.polo === 'ambos'));
  }, [parties, q, polo]);

  const link = async (p: AlertParty) => {
    if (!p.client) return;
    setBusy(p.name);
    try {
      const r = await api(`/clients/${p.client.id}/link-many`, { method: 'POST', body: { processIds: p.processIds, role: roleOf(p) } });
      toast.success(<span>{r.linked} processo(s) vinculado(s) a <Link className="underline" href={`/clientes/detalhe/?id=${p.client.id}`}>{p.client.name}</Link>.</span>);
      onLinked();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Filter className="size-4" />Autores e réus</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Filtrar nome" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-xs">
          {(['todos', 'autor', 'réu'] as const).map((k) => (
            <button key={k} onClick={() => setPolo(k)} className={cn('rounded-md py-1 cursor-pointer capitalize', polo === k ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground')}>{k === 'todos' ? 'Todos' : k === 'autor' ? 'Autores' : 'Réus'}</button>
          ))}
        </div>
        {selected && (
          <button onClick={() => onSelect(null)} className="flex w-full items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs cursor-pointer">
            <span className="truncate">Filtrando: <b>{selected}</b></span><X className="size-3.5 shrink-0" />
          </button>
        )}
        {loading && !parties ? <Skeleton className="h-40" /> : !list.length ? <p className="text-sm text-muted-foreground">Nenhum nome nos alertas.</p> : (
          <ul className="max-h-[70vh] space-y-1.5 overflow-y-auto pr-1">
            {list.map((p) => {
              const pending = p.client && p.linked < p.processIds.length;
              return (
                <li key={p.name} className={cn('rounded-lg border p-2 text-sm', selected === p.name ? 'border-primary bg-primary/5' : 'border-border')}>
                  <button onClick={() => onSelect(selected === p.name ? null : p.name)} className="w-full text-left cursor-pointer">
                    <div className="font-medium leading-snug">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.polo === 'ambos' ? 'autor e réu' : p.polo} · {p.alertIds.length} alerta(s)</div>
                  </button>
                  {p.client ? (
                    <div className="mt-1.5">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-success"><UserCheck className="size-3.5" />Já cadastrado como cliente</div>
                      {pending && !dismissed.has(p.name) ? (
                        <div className="mt-1.5 rounded-md bg-muted p-2 text-xs">
                          <p className="mb-1.5">Vincular {p.processIds.length - p.linked} processo(s) a <b>{p.client.name}</b>?</p>
                          <div className="flex gap-1.5">
                            <Button size="sm" loading={busy === p.name} onClick={() => link(p)}><Check />Sim</Button>
                            <Button size="sm" variant="outline" onClick={() => setDismissed(new Set(dismissed).add(p.name))}><X />Não</Button>
                          </div>
                        </div>
                      ) : p.processIds.length > 0 && !pending ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">Processos já vinculados.</div>
                      ) : null}
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="mt-1.5" onClick={() => onRegister(p)}><UserPlus />Cadastrar cliente</Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
