'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Plus, Radar, RefreshCw, Search, Trash2, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Dialog, Empty, PageHeader, Skeleton, Switch, Table, Td, Th } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { INTERVAL_LABEL, maskInput, timeAgo } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth';
import { NewTargetDialog } from '@/components/new-target-dialog';

function MonitorInner() {
  const params = useSearchParams();
  const [kind, setKind] = useState(params.get('kind') || '');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const { data, loading, reload, setData } = useApi<any[]>(`/targets?kind=${kind}&q=${encodeURIComponent(q)}`, [kind, q]);

  const toggle = async (t: any, monitored: boolean) => {
    setData((d) => d?.map((x) => (x.id === t.id ? { ...x, monitored } : x)) || null);
    await api(`/targets/${t.id}`, { method: 'PATCH', body: { monitored } }).catch((e) => toast.error(e.message));
  };
  const setInterval_ = async (t: any, intervalMinutes: number) => {
    setData((d) => d?.map((x) => (x.id === t.id ? { ...x, intervalMinutes } : x)) || null);
    await api(`/targets/${t.id}`, { method: 'PATCH', body: { intervalMinutes } }).catch((e) => toast.error(e.message));
  };
  const { user } = useAuth();
  const remove = async (t: any) => {
    if (!confirm(`Excluir o monitorado ${t.name}?\n\nO acompanhamento para e são apagados os processos, movimentações e alertas coletados (LGPD). Se for cliente, o cadastro do cliente é mantido. Esta ação não pode ser desfeita.`)) return;
    try {
      await api(`/targets/${t.id}`, { method: 'DELETE' });
      setData((d) => d?.filter((x) => x.id !== t.id) || null);
      toast.success(`${t.name} foi excluído do monitoramento.`);
    } catch (e: any) { toast.error(e.message); }
  };
  const [checking, setChecking] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const check = async (t: any) => {
    setChecking(t.id);
    const id = toast.loading(`Consultando ${t.name}…`);
    try { const r = await api(`/targets/${t.id}/check`, { method: 'POST' }); toast.success(`${t.name}: +${r.newProcesses} processo(s), +${r.newMovements} movimentação(ões), ${r.alerts} alerta(s).`, { id }); reload(true); }
    catch (e: any) { toast.error(e.message, { id }); } finally { setChecking(null); }
  };
  /** Consulta agora todos os monitorados ativos da lista, um de cada vez (as fontes limitam consultas seguidas). */
  const checkAll = async () => {
    const list = (data || []).filter((t) => t.monitored);
    const targets = list.length ? list : data || [];
    if (!targets.length) return;
    const id = toast.loading(`Consultando 1 de ${targets.length}…`);
    const sum = { processes: 0, movements: 0, alerts: 0, errors: 0 };
    for (let i = 0; i < targets.length; i++) {
      setProgress({ done: i, total: targets.length }); setChecking(targets[i].id);
      toast.loading(`Consultando ${i + 1} de ${targets.length}: ${targets[i].name}…`, { id });
      try {
        const r = await api(`/targets/${targets[i].id}/check`, { method: 'POST' });
        sum.processes += r.newProcesses || 0; sum.movements += r.newMovements || 0; sum.alerts += r.alerts || 0;
      } catch { sum.errors++; }
    }
    setProgress(null); setChecking(null); reload(true);
    toast.success(`Consulta concluída: +${sum.processes} processo(s), +${sum.movements} movimentação(ões), ${sum.alerts} alerta(s)${sum.errors ? ` · ${sum.errors} com erro` : ''}.`, { id });
  };

  return (
    <>
      <PageHeader title="Monitoramento" description="Pessoas e empresas acompanhadas automaticamente." actions={<div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={checkAll} disabled={!!progress || !data?.length} title="Atualiza agora a consulta de todos os monitorados ativos">
            <RefreshCw className={progress ? 'animate-spin' : undefined} />{progress ? `Consultando ${progress.done + 1} de ${progress.total}…` : 'Consultar agora'}
          </Button>
          <Button onClick={() => setOpen(true)}><Plus />Novo monitoramento</Button>
        </div>} />
      <Card>
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Filtrar por nome ou CPF/CNPJ" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="sm:w-48" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos</option><option value="PF">Pessoas físicas</option><option value="PJ">Pessoas jurídicas</option></Select>
        </div>
        {loading && !data ? <div className="p-4"><Skeleton className="h-40" /></div> : !data?.length ? (
          <Empty icon={Radar} title="Nada monitorado ainda">Cadastre uma pessoa ou empresa para receber alertas de novos processos, movimentações e intimações.</Empty>
        ) : (
          <Table>
            <thead><tr><Th>Nome</Th><Th>Documento</Th><Th>Processos</Th><Th>Alertas</Th><Th>Frequência</Th><Th>Última verificação</Th><Th>Ativo</Th><Th /></tr></thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40">
                  <Td><Link href={`/alvo/?id=${t.id}`} className="flex items-center gap-2 font-medium hover:underline">{t.kind === 'PF' ? <User className="size-4 text-muted-foreground" /> : <Building2 className="size-4 text-muted-foreground" />}{t.name}</Link></Td>
                  <Td className="font-mono text-xs">{t.document || '—'}</Td>
                  <Td className="tabular-nums">{t.counts?.processes ?? 0}</Td>
                  <Td>{t.counts?.alerts ? <Badge tone="gold">{t.counts.alerts}</Badge> : <span className="text-muted-foreground">0</span>}</Td>
                  <Td><Select className="h-8 w-32 text-xs" value={t.intervalMinutes} onChange={(e) => setInterval_(t, Number(e.target.value))}>{Object.entries(INTERVAL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Td>
                  <Td className="text-xs text-muted-foreground">{timeAgo(t.lastCheckedAt)}</Td>
                  <Td><Switch checked={t.monitored} onChange={(v) => toggle(t, v)} label="Monitoramento ativo" /></Td>
                  <Td className="whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => check(t)} disabled={!!checking} title="Consultar agora" aria-label={`Consultar agora ${t.name}`}><RefreshCw className={checking === t.id ? 'animate-spin' : undefined} />Consultar</Button>
                    {user?.role !== 'leitor' && <Button variant="ghost" size="icon" className="text-danger" onClick={() => remove(t)} title="Excluir monitorado" aria-label={`Excluir ${t.name}`}><Trash2 /></Button>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <NewTargetDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function MonitorPage() { return <Suspense><MonitorInner /></Suspense>; }
