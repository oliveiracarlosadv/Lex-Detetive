'use client';
import Link from 'next/link';
import { Activity, AlertTriangle, Bell, Building2, FileSearch, Radar, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, PageHeader, Skeleton } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';

// Gráficos (biblioteca pesada) carregam depois do resto da tela: abertura mais rápida em PCs modestos.
const MovementsChart = dynamic(() => import('@/components/dashboard/charts').then((m) => m.MovementsChart), { ssr: false, loading: () => <Skeleton className="h-56" /> });
const CourtsChart = dynamic(() => import('@/components/dashboard/charts').then((m) => m.CourtsChart), { ssr: false, loading: () => <Skeleton className="h-56" /> });
import { AlertCard } from '@/components/alert-card';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { useApi } from '@/lib/use-api';

function Stat({ icon: Icon, label, value, hint, href }: { icon: React.ElementType; label: string; value: number | string; hint?: string; href?: string }) {
  const body = (
    <Card className="p-4 transition-colors hover:border-input">
      <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs">{label}</span><Icon className="size-4" /></div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function Dashboard() {
  const { data, loading, reload } = useApi<any>('/dashboard');
  const k = data?.kpis;
  const read = async (id: string) => { await api(`/alerts/${id}/read`, { method: 'POST' }); reload(true); };

  return (
    <>
      <PageHeader title="Painel" description="Visão geral do monitoramento jurídico."
        actions={<><Link href="/pesquisa/"><Button variant="outline"><FileSearch />Nova pesquisa</Button></Link><Link href="/monitoramento/"><Button><Radar />Monitorar</Button></Link></>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading && !k ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : k && (
          <>
            <Stat icon={Users} label="Pessoas monitoradas" value={k.pessoasMonitoradas} hint={`${k.pessoas} cadastradas`} href="/monitoramento/?kind=PF" />
            <Stat icon={Building2} label="Empresas monitoradas" value={k.empresasMonitoradas} hint={`${k.empresas} cadastradas`} href="/monitoramento/?kind=PJ" />
            <Stat icon={FileSearch} label="Processos encontrados" value={k.processos} hint={`${k.processosAtivos} ativos`} />
            <Stat icon={Bell} label="Alertas não lidos" value={k.alertasNaoLidos} hint={`${k.movimentacoes7d} movimentações em 7 dias`} href="/alertas/" />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Movimentações por dia</CardTitle><CardDescription>Últimos 30 dias, todos os processos monitorados</CardDescription></div></CardHeader>
          <CardContent>{data ? <MovementsChart data={data.movementsByDay} /> : <Skeleton className="h-56" />}</CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Processos por tribunal</CardTitle><CardDescription>Os 8 tribunais com mais processos</CardDescription></div></CardHeader>
          <CardContent>{data ? (data.byCourt.length ? <CourtsChart data={data.byCourt} /> : <Empty icon={Activity} title="Sem processos ainda" />) : <Skeleton className="h-56" />}</CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><div><CardTitle>Linha do tempo processual</CardTitle><CardDescription>Movimentações mais recentes</CardDescription></div></CardHeader>
          <CardContent>
            {!data ? <Skeleton className="h-64" /> : data.recentMovements.length === 0 ? (
              <Empty icon={Activity} title="Nenhuma movimentação ainda">Cadastre uma pessoa ou empresa em Monitoramento para começar.</Empty>
            ) : (
              <ol className="relative ml-2 border-l border-border">
                {data.recentMovements.map((m: any) => (
                  <li key={m.id} className="mb-4 ml-4">
                    <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-card bg-primary" />
                    <div className="text-xs text-muted-foreground">{fmtDate(m.date)} · <Link className="hover:underline" href={`/alvo/?id=${m.process.target.id}`}>{m.process.target.name}</Link></div>
                    <div className="text-sm">{m.description}</div>
                    <Link href={`/processo/?id=${m.process.id}`} className="text-xs text-primary hover:underline">{m.process.number} · {m.process.court}</Link>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Alertas</CardTitle><CardDescription>Não lidos</CardDescription></div><Link href="/alertas/" className="text-xs text-primary hover:underline">Ver todos</Link></CardHeader>
          <CardContent className="space-y-3">
            {!data ? <Skeleton className="h-64" /> : data.alerts.length === 0 ? <Empty icon={AlertTriangle} title="Tudo em dia" >Nenhum alerta pendente.</Empty> :
              data.alerts.slice(0, 4).map((a: any) => <AlertCard key={a.id} alert={a} onRead={read} />)}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
