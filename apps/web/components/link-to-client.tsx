'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Link2, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Field, Select } from './ui/input';
import { Dialog } from './ui/misc';
import { ClientPicker, PickedClient } from './client-picker';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const ROLES = [['autor', 'Autor'], ['réu', 'Réu'], ['terceiro', 'Terceiro'], ['interessado', 'Interessado'], ['parte', 'Parte']];

/**
 * "Vincular ao cliente": associa um processo (já gravado, por id; ou encontrado na
 * pesquisa, pelo número CNJ) a um cliente cadastrado, com o papel dele no processo.
 */
type Suggestion = PickedClient & { role: string; reason: string };

export function LinkToClientButton({ processId, number, targetId, variant = 'button', onLinked, parties, document, preferred }: {
  processId?: string; number?: string; targetId?: string; variant?: 'button' | 'link' | 'icon'; onLinked?: () => void;
  /** Partes do processo: clientes cadastrados com o mesmo nome são sugeridos. */
  parties?: { name: string; role?: string }[];
  /** CPF/CNPJ pesquisado: cliente com o mesmo documento é sugerido. */
  document?: string;
  /** Cliente já escolhido na pesquisa. */
  preferred?: PickedClient | null;
}) {
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState<PickedClient | null>(null);
  const [role, setRole] = useState('parte');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const pick = (s: Suggestion | PickedClient) => { setClient({ id: s.id, name: s.name, kind: s.kind }); if ('role' in s) setRole(s.role); };

  // Ao abrir: procura clientes cadastrados entre as partes do processo e já deixa o mais provável escolhido.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const local = (parties || []).filter((p) => p?.name);
    if (!local.length && !document && !preferred) return;
    api<Suggestion[]>('/clients/suggest', { method: 'POST', body: { parties: local, document } })
      .then((list) => {
        if (!alive) return;
        const all = preferred && !list.some((s) => s.id === preferred.id)
          ? [{ ...preferred, role: 'parte', reason: 'cliente escolhido na pesquisa' }, ...list] : list;
        setSuggestions(all);
        if (all[0]) setClient((c) => { if (!c) { setRole(all[0].role); return { id: all[0].id, name: all[0].name, kind: all[0].kind }; } return c; });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!client) return toast.error('Escolha o cliente.');
    setBusy(true);
    try {
      await api(`/clients/${client.id}/processes`, { method: 'POST', body: processId ? { processId, role } : number ? { number, role } : { targetId, role } });
      toast.success(<span>Processo vinculado a <Link className="underline" href={`/clientes/detalhe/?id=${client.id}`}>{client.name}</Link>.</span>);
      setOpen(false); setClient(null); onLinked?.();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const trigger = variant === 'button'
    ? <Button variant="outline" onClick={() => setOpen(true)}><Link2 />Vincular ao cliente</Button>
    : variant === 'icon'
      ? <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Vincular ao cliente" aria-label="Vincular ao cliente"><Link2 /></Button>
      : <button onClick={() => setOpen(true)} className={cn('text-xs font-medium text-primary hover:underline cursor-pointer')}><Link2 className="mr-1 inline size-3" />Vincular ao cliente</button>;

  return (
    <>
      {trigger}
      <Dialog open={open} onClose={() => setOpen(false)} title="Vincular processo ao cliente" description={number ? `Processo ${number}` : targetId && !processId ? 'Todos os processos desta pessoa/empresa serão vinculados ao cliente.' : undefined}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} loading={busy} disabled={!client}><Link2 />Vincular</Button></>}>
        <div className="space-y-3">
          {suggestions.length > 0 && (
            <div className="rounded-lg border border-gold/40 bg-gold/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium"><Sparkles className="size-3.5 text-gold" />Cliente(s) cadastrado(s) neste processo</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s.id} type="button" onClick={() => pick(s)}
                    className={cn('rounded-md border px-2.5 py-1.5 text-left text-sm cursor-pointer', client?.id === s.id ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted')}>
                    {s.name}<span className="block text-[11px] font-normal text-muted-foreground">{s.reason}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <ClientPicker value={client} onChange={setClient} selectedLabel="Cliente selecionado" placeholder="Buscar cliente pelo nome, e-mail ou CPF/CNPJ" />
          <Field label="Papel do cliente no processo">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          </Field>
          <p className="text-xs text-muted-foreground">O cliente ainda não está cadastrado? <Link href="/clientes/" className="text-primary underline">Cadastre em Clientes</Link> e volte aqui.</p>
        </div>
      </Dialog>
    </>
  );
}
