'use client';
import { CheckCircle2, ExternalLink, Clock, MousePointerClick } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { useApi } from '@/lib/use-api';

const STATUS = {
  integrado: { label: 'Integrado', tone: 'green' as const, icon: CheckCircle2 },
  manual: { label: 'Consulta manual', tone: 'blue' as const, icon: MousePointerClick },
  planejado: { label: 'Planejado', tone: 'neutral' as const, icon: Clock },
};

export default function SourcesPage() {
  const { data: connectors } = useApi<any[]>('/connectors');
  const { data: catalog } = useApi<any[]>('/sources/catalog');
  const groups = catalog ? Object.entries(catalog.reduce((acc: Record<string, any[]>, s) => { (acc[s.group] ||= []).push(s); return acc; }, {})) : [];
  return (
    <>
      <PageHeader title="Fontes" description="Conectores ativos e cobertura por tribunal e cartório." />
      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!connectors ? <Skeleton className="h-32" /> : connectors.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-2"><div className="text-sm font-medium">{c.name}</div><Badge tone={c.enabled ? 'green' : 'neutral'}>{c.enabled ? 'ativo' : 'inativo'}</Badge></div>
            <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
            {!c.enabled && c.reason && <p className="mt-2 text-xs text-danger">{c.reason}</p>}
            <div className="mt-2 flex flex-wrap gap-1">{c.capabilities.map((x: string) => <Badge key={x}>{x}</Badge>)}</div>
            {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">Documentação <ExternalLink className="size-3" /></a>}
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(([group, items]) => (
          <Card key={group}>
            <CardHeader><div><CardTitle>{group}</CardTitle><CardDescription>{items.filter((i) => i.status === 'integrado').length} de {items.length} integrados</CardDescription></div></CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">{items.map((s) => { const st = STATUS[s.status as keyof typeof STATUS]; return (
                <li key={s.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <st.icon className={`size-4 ${s.status === 'integrado' ? 'text-success' : 'text-muted-foreground'}`} />
                  <span className="flex-1">{s.name}{s.system && <span className="text-xs text-muted-foreground"> · {s.system}</span>}{s.note && <span className="block text-[11px] text-muted-foreground">{s.note}</span>}</span>
                  {s.via && <span className="text-[11px] text-muted-foreground">via {s.via}</span>}
                  {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer"><Badge tone={st.tone}>{st.label} <ExternalLink className="size-3" /></Badge></a> : <Badge tone={st.tone}>{st.label}</Badge>}
                </li>); })}</ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
