'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, Wand2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty, Skeleton } from '@/components/ui/misc';
import { ProcessCardView } from '@/components/alert-card';
import { AnalysisView } from '@/components/analysis-view';
import { LinkToClientButton } from '@/components/link-to-client';
import { CourtTag, DocTag } from '@/components/process-tags';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { useApi } from '@/lib/use-api';

const INTIMACAO = /intima[çc]|cita[çc][ãa]o|cite-se|notifica[çc]|mandado de|prazo/i;

function ProcessInner() {
  const id = useSearchParams().get('id')!;
  const { data: p, reload } = useApi<any>(`/processes/${id}`);
  const [busy, setBusy] = useState<'' | 'ai' | 'rules'>('');
  if (!p) return <Skeleton className="h-96" />;

  const analyze = async (useAi: boolean) => {
    setBusy(useAi ? 'ai' : 'rules');
    try { await api(`/ai/processes/${id}/analyze`, { method: 'POST', body: { useAi } }); reload(true); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(''); }
  };

  return (
    <>
      <Link href={`/alvo/?id=${p.target.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{p.target.name}</Link>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-mono text-xl font-semibold">{p.number}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CourtTag court={p.court} /><span>{p.className}</span><Badge tone={p.status === 'ativo' ? 'green' : 'neutral'}>{p.status}</Badge><DocTag status={p.docStatus} found={p.docFound} />{p.system && <Badge>{p.system}</Badge>}<Badge>fonte: {p.source}</Badge>
          </div>
          {p.subjects?.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Assuntos: {p.subjects.join(', ')}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Clientes vinculados: {p.clients?.length ? p.clients.map((c: any, i: number) => <span key={c.id}>{i > 0 && ', '}<Link href={`/clientes/detalhe/?id=${c.id}`} className="text-primary hover:underline">{c.name}</Link> ({c.role})</span>) : 'nenhum'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => analyze(true)} loading={busy === 'ai'}><Sparkles />Analisar com Lex AI</Button>
          <Button variant="outline" onClick={() => analyze(false)} loading={busy === 'rules'}><Wand2 />Análise rápida</Button>
          <LinkToClientButton processId={id} onLinked={() => reload(true)} />
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader><div><CardTitle>Resumo do processo</CardTitle><CardDescription>Ficha consolidada a partir das movimentações disponíveis na fonte</CardDescription></div></CardHeader>
        <CardContent><ProcessCardView card={p.card} /></CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Movimentações ({p.movements.length})</CardTitle><CardDescription>Intimações e citações em destaque</CardDescription></div></CardHeader>
          <CardContent>
            {!p.movements.length ? <Empty title="Sem movimentações">Faça uma verificação na página da pessoa/empresa.</Empty> : (
              <ol className="relative ml-2 max-h-[640px] overflow-y-auto border-l border-border pr-2">
                {p.movements.map((m: any) => {
                  const hot = INTIMACAO.test(m.description);
                  return (
                    <li key={m.id} className="mb-3 ml-4">
                      <span className={`absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-card ${hot ? 'bg-danger' : 'bg-primary'}`} />
                      <div className="text-xs text-muted-foreground">{fmtDate(m.date)}</div>
                      <div className={`text-sm ${hot ? 'font-medium' : ''}`}>{m.description}{hot && <Badge tone="red" className="ml-2">intimação</Badge>}</div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader><div><CardTitle>Lex AI</CardTitle><CardDescription>Resumo, partes, valores, riscos, prescrição, prazos e parecer inicial</CardDescription></div></CardHeader>
          <CardContent>
            {busy ? <div className="space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
              : p.analyses?.length ? <AnalysisView a={p.analyses[0]} />
              : <Empty icon={Sparkles} title="Nenhuma análise ainda">Use “Analisar com Lex AI” (modelo configurado) ou “Análise rápida” (regras, sem IA).</Empty>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function ProcessPage() { return <Suspense><ProcessInner /></Suspense>; }
