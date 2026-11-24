'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Bell, Building2, Eye, Radar, History, Plus, RefreshCw, Scale, Share2, Sparkles, Trash2, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { Empty, Skeleton, Switch, Table, Tabs, Td, Th } from '@/components/ui/misc';
import { AlertCard } from '@/components/alert-card';
import { AnalysisView } from '@/components/analysis-view';
import { ReportButton } from '@/components/report-button';
import { PartiesLines } from '@/components/parties-lines';
import { LinkToClientButton } from '@/components/link-to-client';
import { CourtTag, DocTag } from '@/components/process-tags';
import { BnmpButton } from '@/components/bnmp-button';
import { FindingsPanel } from '@/components/findings-panel';
import { api } from '@/lib/api';
import { cnjYear, fmtDate, fmtDateTime, fmtMoney, INTERVAL_LABEL, maskInput, timeAgo, yearsOf } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth';

function TargetInner() {
  const id = useSearchParams().get('id')!;
  const router = useRouter();
  const { user } = useAuth();
  const [reveal, setReveal] = useState(false);
  const [tab, setTab] = useState<'processos' | 'alertas' | 'publicacoes' | 'historico' | 'ia'>('processos');
  const [number, setNumber] = useState('');
  const [doc, setDoc] = useState('');
  const [docFilter, setDocFilter] = useState<'todos' | 'sem_divergentes' | 'so_conferidos'>('todos');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState('');
  const { data: t, error, reload, setData } = useApi<any>(`/targets/${id}?reveal=${reveal}`, [reveal]);
  const { data: alerts, reload: reloadAlerts } = useApi<any[]>(`/alerts?targetId=${id}`);

  if (!t && error) return (
    <Card><Empty icon={Radar} title="Monitoramento não encontrado">
      {error} Ele pode ter sido excluído. Volte ao cliente e clique em <strong>Monitorar</strong> para criar um novo.
      <div className="mt-4 flex justify-center gap-2"><Button variant="outline" onClick={() => router.back()}><ArrowLeft />Voltar</Button><Link href="/monitoramento/"><Button>Ir para Monitoramento</Button></Link></div>
    </Empty></Card>
  );
  if (!t) return <Skeleton className="h-96" />;
  const real = t.processes.filter((p: any) => p.source !== 'manual' || p.court !== '—');

  const update = async (body: any) => {
    setData({ ...t, ...body });
    await api(`/targets/${id}`, { method: 'PATCH', body }).catch((e) => toast.error(e.message));
  };
  const check = async () => {
    setBusy('check');
    try { const r = await api(`/targets/${id}/check`, { method: 'POST' }); toast.success(`Verificação concluída: +${r.newProcesses} processo(s), +${r.newMovements} movimentação(ões).`); reload(true); reloadAlerts(true); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(''); }
  };
  /** CPF/CNPJ informado depois do cadastro: salva e refaz a busca completa para conferir os processos. */
  const saveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('doc');
    try {
      await api(`/targets/${id}`, { method: 'PATCH', body: { document: doc } });
      toast.info('Documento salvo. Conferindo as publicações…');
      const r = await api(`/targets/${id}/check`, { method: 'POST' });
      toast.success(`Conferência concluída (${r.newMovements} movimentação(ões) nova(s)).`);
      setDoc(''); reload(true);
    } catch (err: any) { toast.error(err.message); } finally { setBusy(''); }
  };

  const attach = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('attach');
    try { await api(`/targets/${id}/processes`, { method: 'POST', body: { number } }); setNumber(''); toast.success('Processo vinculado e consultado no DJEN.'); reload(true); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(''); }
  };
  const analyze = async () => {
    setBusy('ai'); setTab('ia');
    try { await api(`/ai/targets/${id}/analyze`, { method: 'POST', body: {} }); reload(true); toast.success('Parecer gerado.'); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(''); }
  };
  const remove = async () => {
    if (!confirm(`Excluir o monitorado ${t.name}?\n\nO acompanhamento para e são apagados os processos, movimentações e alertas coletados (LGPD). Se for cliente, o cadastro do cliente é mantido. Esta ação não pode ser desfeita.`)) return;
    try { await api(`/targets/${id}`, { method: 'DELETE' }); } catch (e: any) { return toast.error(e.message); }
    toast.success(`${t.name} foi excluído do monitoramento.`);
    router.push('/monitoramento/');
  };
  const read = async (aid: string) => { await api(`/alerts/${aid}/read`, { method: 'POST' }); reloadAlerts(true); };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">{t.kind === 'PF' ? <User className="size-6" /> : <Building2 className="size-6" />}</div>
          <div>
            <h1 className="text-xl font-semibold">{t.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{t.kind === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}</span>
              {t.document && <span className="font-mono">· {t.document}</span>}
              {t.document && user?.role !== 'leitor' && <button onClick={() => setReveal(!reveal)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"><Eye className="size-3" />{reveal ? 'ocultar' : 'mostrar'}</button>}
            </div>
            {t.purpose && <p className="mt-1 text-xs text-muted-foreground">Finalidade: {t.purpose}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={check} loading={busy === 'check'}><RefreshCw />Verificar agora</Button>
          <Button variant="outline" onClick={analyze} loading={busy === 'ai'}><Sparkles />Parecer IA</Button>
          <ReportButton targetId={id} />
          <BnmpButton name={t.name} />
          {user?.role !== 'leitor' && <Button variant="outline" className="text-danger" onClick={remove}><Trash2 />Excluir monitorado</Button>}
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Monitoramento</div><div className="mt-2 flex items-center gap-3"><Switch checked={t.monitored} onChange={(v) => update({ monitored: v })} label="Monitoramento" /><span className="text-sm">{t.monitored ? 'Ativo' : 'Pausado'}</span></div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Frequência</div><Select className="mt-1.5 h-8" value={t.intervalMinutes} onChange={(e) => update({ intervalMinutes: Number(e.target.value) })}>{Object.entries(INTERVAL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Última verificação</div><div className="mt-2 text-sm" title={fmtDateTime(t.lastCheckedAt)}>{timeAgo(t.lastCheckedAt)}</div>{t.monitored && t.nextCheckAt && <div className="text-xs text-muted-foreground">próxima {fmtDateTime(t.nextCheckAt)}</div>}</Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Fontes na última verificação</div><div className="mt-2 flex flex-wrap gap-1">{t.lastCheck?.sources?.filter((s: any) => !s.skipped).map((s: any) => <Badge key={s.id} tone={s.ok ? 'green' : 'red'} title={s.message}>{s.id}</Badge>) || '—'}</div></Card>
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { value: 'processos', label: `Processos (${real.length})`, icon: Scale },
        { value: 'alertas', label: `Alertas (${alerts?.length ?? 0})`, icon: Bell },
        { value: 'publicacoes', label: 'Publicações e redes', icon: Share2 },
        { value: 'historico', label: 'Cadastro e histórico', icon: History },
        { value: 'ia', label: 'Lex AI', icon: Sparkles },
      ]} />

      <div className="mt-4">
        {tab === 'processos' && (
          <Card>
            <form onSubmit={attach} className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row">
              <Input placeholder="Vincular processo pelo número CNJ (0000000-00.0000.0.00.0000)" value={number} onChange={(e) => setNumber(maskInput('cnj', e.target.value))} />
              <Button variant="outline" loading={busy === 'attach'} disabled={number.replace(/\D/g, '').length !== 20}><Plus />Vincular</Button>
            </form>
            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">{t.kind === 'PF' ? 'CPF' : 'CNPJ'} do monitorado: </span>
                {t.document ? (
                  <>
                    <span className="font-mono font-semibold">{t.document}</span>
                    {user?.role !== 'leitor' && <button onClick={() => setReveal(!reveal)} className="ml-2 text-xs text-primary hover:underline cursor-pointer">{reveal ? 'ocultar' : 'mostrar'}</button>}
                  </>
                ) : (
                  <form onSubmit={saveDoc} className="mt-1 inline-flex flex-wrap items-center gap-2">
                    <span className="text-danger">não cadastrado — sem ele não dá para separar homônimos.</span>
                    <Input className="h-8 w-44" placeholder={t.kind === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'} value={doc} onChange={(e) => setDoc(maskInput(t.kind === 'PF' ? 'cpf' : 'cnpj', e.target.value))} />
                    <Button size="sm" loading={busy === 'doc'}>Salvar e conferir</Button>
                  </form>
                )}
              </div>
              {t.document && t.docSummary && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="green">{t.docSummary.confirmado} com CPF conferido</Badge>
                  <Badge>{t.docSummary.nao_informado} sem CPF na publicação</Badge>
                  {t.docSummary.divergente > 0 && <Badge tone="red">{t.docSummary.divergente} com CPF diferente (possíveis homônimos)</Badge>}
                  <Select className="h-8 w-56 text-xs" value={docFilter} onChange={(e) => setDocFilter(e.target.value as any)} aria-label="Filtrar pela conferência de CPF">
                    <option value="todos">Todos os processos</option>
                    <option value="sem_divergentes">Ocultar CPF diferente</option>
                    <option value="so_conferidos">Só com CPF conferido</option>
                  </Select>
                </div>
              )}
            </div>
            {t.processes.length === 0 ? (
              <Empty icon={Scale} title="0 (zero) processos encontrados">
                Podem existir processos que tramitam em sigilo (segredo de justiça), que não aparecem em consultas públicas. Vincule números de processo conhecidos para monitorar movimentações e intimações.
              </Empty>
            ) : (<>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Ano do processo:</span>
                <Select className="h-8 w-44 text-xs" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Filtrar processos por ano">
                  <option value="">Todos os anos</option>
                  {yearsOf(t.processes).map(([y, n]) => <option key={y} value={y}>{y} ({n})</option>)}
                </Select>
                {year && <button className="text-primary hover:underline cursor-pointer" onClick={() => setYear('')}>limpar</button>}
              </div>
              <Table>
                <thead><tr><Th>Número</Th><Th>Tribunal / Vara</Th><Th>Classe / Autor / Réu</Th><Th>CPF na publicação</Th><Th>Valor</Th><Th>Situação</Th><Th>Última mov.</Th></tr></thead>
                <tbody>{t.processes.filter((p: any) => (!year || cnjYear(p.number) === year) && (docFilter === 'todos' || (docFilter === 'so_conferidos' ? p.docStatus === 'confirmado' : p.docStatus !== 'divergente'))).map((p: any) => (
                  <tr key={p.id} className={p.docStatus === 'divergente' ? 'bg-danger/5 hover:bg-danger/10' : 'hover:bg-muted/40'}>
                    <Td><div className="flex items-start gap-1"><div><Link href={`/processo/?id=${p.id}`} className="whitespace-nowrap font-mono text-xs text-primary hover:underline">{p.number}</Link><div className="text-[11px] text-muted-foreground">{p.source}</div></div><LinkToClientButton processId={p.id} variant="icon" /></div></Td>
                    <Td><CourtTag court={p.court} /><div className="mt-1 text-xs text-muted-foreground">{p.organ}</div></Td>
                    <Td className="max-w-72">{p.className}<PartiesLines parties={p.parties} /></Td>
                    <Td className="whitespace-nowrap"><DocTag status={p.docStatus} found={p.docFound} /></Td>
                    <Td className="tabular-nums">{fmtMoney(p.value)}</Td>
                    <Td><Badge tone={p.status === 'ativo' ? 'green' : 'neutral'}>{p.status}</Badge></Td>
                    <Td className="text-xs">{fmtDate(p.lastMovementAt)}</Td>
                  </tr>
                ))}</tbody>
              </Table>
            </>
            )}
          </Card>
        )}
        {tab === 'alertas' && (
          <div className="space-y-3">{!alerts?.length ? <Card><Empty icon={Bell} title="Sem alertas" /></Card> : alerts.map((a) => <AlertCard key={a.id} alert={a} onRead={read} />)}</div>
        )}
        {tab === 'publicacoes' && <FindingsPanel target={t} canEdit={user?.role !== 'leitor'} onChanged={() => reload(true)} />}
        {tab === 'historico' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Dados cadastrais</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  {[['Nome', t.name], ['Nome fantasia', t.tradeName], ['Documento', t.document], ['RG', t.rg], ['Mãe', t.motherName], ['Pai', t.fatherName], ['Sócios', t.partners?.join(', ')], ['Redes sociais', t.usernames], ['Cadastrado em', fmtDateTime(t.createdAt)]].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex gap-3"><dt className="w-32 shrink-0 text-muted-foreground">{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
                {t.registry && (
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="mb-2 text-xs font-medium">Receita Federal</div>
                    <dl className="space-y-1 text-sm">{Object.entries(t.registry).filter(([k]) => k !== 'socios').map(([k, v]) => <div key={k} className="flex gap-3"><dt className="w-32 shrink-0 text-muted-foreground">{k}</dt><dd>{String(v ?? '—')}</dd></div>)}</dl>
                  </div>
                )}
                {user?.role !== 'leitor' && <Button variant="ghost" className="mt-4 text-danger" onClick={remove}><Trash2 />Eliminar dados (LGPD)</Button>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Histórico de verificações</CardTitle><CardDescription>Snapshots e alterações detectadas</CardDescription></div></CardHeader>
              <CardContent>
                {!t.snapshots.length ? <Empty title="Sem histórico" /> : (
                  <ol className="space-y-3">{t.snapshots.map((s: any) => (
                    <li key={s.id} className="text-sm"><div className="text-xs text-muted-foreground">{fmtDateTime(s.createdAt)} · {s.source}</div>
                      {s.changes ? <div>{Array.isArray(s.changes) && s.changes[0]?.field ? `Alterado: ${s.changes.map((c: any) => c.field).join(', ')}` : `${s.changes.length} novo(s) registro(s)`}</div> : <div className="text-muted-foreground">Registro inicial</div>}
                    </li>
                  ))}</ol>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        {tab === 'ia' && (
          <Card><CardContent className="pt-5">
            {busy === 'ai' ? <Skeleton className="h-40" /> : t.analyses?.length ? <AnalysisView a={t.analyses[0]} /> : (
              <Empty icon={Sparkles} title="Nenhum parecer ainda"><Button className="mt-3" onClick={analyze}><Sparkles />Gerar parecer com Lex AI</Button></Empty>
            )}
          </CardContent></Card>
        )}
      </div>
    </>
  );
}

export default function TargetPage() { return <Suspense><TargetInner /></Suspense>; }
