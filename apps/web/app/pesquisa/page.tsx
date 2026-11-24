'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertCircle, Building2, CheckCircle2, ExternalLink, FileSearch, Lock, Radar, Search, ShieldAlert, User, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader, Table, Td, Th } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney, INTERVAL_LABEL, maskInput, cnjYear, yearsOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BnmpButton } from '@/components/bnmp-button';
import { ClientPicker, PickedClient } from '@/components/client-picker';
import { PartiesLines } from '@/components/parties-lines';
import { LinkToClientButton } from '@/components/link-to-client';
import { CourtTag, DocTag } from '@/components/process-tags';

const EMPTY = { name: '', cpf: '', cnpj: '', rg: '', motherName: '', fatherName: '', tradeName: '', partners: '', numbers: '', oab: '', usernames: '' };
type Fields = typeof EMPTY;

function buildQuery(kind: 'PF' | 'PJ', f: Fields, extraNumbers: string[] = []) {
  const numbers = [...(f.numbers ? f.numbers.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) : []), ...extraNumbers];
  return {
    kind, name: f.name || undefined, cpf: kind === 'PF' ? f.cpf || undefined : undefined, cnpj: kind === 'PJ' ? f.cnpj || undefined : undefined,
    oab: kind === 'PF' && f.oab ? f.oab : undefined,
    rg: f.rg || undefined, motherName: f.motherName || undefined, fatherName: f.fatherName || undefined, tradeName: f.tradeName || undefined,
    partners: f.partners ? f.partners.split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
    processNumbers: numbers.length ? [...new Set(numbers)] : undefined,
    usernames: f.usernames ? f.usernames.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) : undefined,
  };
}

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [kind, setKind] = useState<'PF' | 'PJ'>('PF');
  // Tabelas longas: mostra 100 linhas por vez (leve em processadores modestos).
  const [shown, setShown] = useState(100);
  const [year, setYear] = useState('');
  const [f, setF] = useState<Fields>({ ...EMPTY, name: params.get('q') || '' });
  const [client, setClient] = useState<PickedClient | null>(null);

  /** Ao escolher um cliente cadastrado, preenche a pesquisa com os dados e processos dele. */
  const pickClient = async (c: PickedClient | null, quiet = false) => {
    setClient(c);
    if (!c) return null;
    try {
      const d = await api(`/clients/${c.id}?reveal=true`);
      const fields = {
        name: d.name || '', tradeName: d.tradeName || '', rg: d.rg && d.rg !== '***' ? d.rg : '',
        cpf: d.kind === 'PF' && d.document && !d.document.includes('*') ? d.document : '',
        cnpj: d.kind === 'PJ' && d.document && !d.document.includes('*') ? d.document : '',
        // Processos já vinculados seguem monitorados pela rotina do cliente; não repetimos aqui.
        numbers: '',
      };
      setKind(d.kind);
      setF((x) => ({ ...x, ...fields }));
      if (d.processes.length && !quiet) toast.info(`${d.name} já tem ${d.processes.length} processo(s) vinculado(s), acompanhados pela rotina do cliente.`);
      return { kind: d.kind as 'PF' | 'PJ', fields, linked: d.processes.map((l: any) => l.process?.number).filter(Boolean) as string[] };
    } catch (e: any) { toast.error(e.message); return null; }
  };
  useEffect(() => {
    const id = params.get('cliente');
    if (!id) return;
    api(`/clients/${id}`).then(async (c) => {
      const d = await pickClient({ id: c.id, name: c.name, kind: c.kind }, true);
      // "Consultar bases" (aba Clientes): pesquisa na hora em todas as fontes, incluindo os processos já vinculados.
      if (d && params.get('consultar')) run(undefined, buildQuery(d.kind, { ...EMPTY, ...d.fields }, d.linked));
    }).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [interval, setInterval_] = useState(1440);
  const [purpose, setPurpose] = useState('');
  const [cnpjBusy, setCnpjBusy] = useState(false);
  /** Preenche razão social, nome fantasia e sócios pelos dados públicos do CNPJ (BrasilAPI + CNPJá). */
  const fillCnpj = async () => {
    setCnpjBusy(true);
    try {
      const r = await api(`/cnpj/${f.cnpj.replace(/\D/g, '')}`);
      const g = r.registry || {};
      setF((x) => ({ ...x, name: g.razaoSocial || x.name, tradeName: g.nomeFantasia || x.tradeName, partners: (g.socios || []).map((s: any) => s.nome).filter(Boolean).join('\n') || x.partners }));
      toast.success(`${g.razaoSocial} — ${g.situacao || 'situação não informada'} (dados de ${r.sources.join(' e ')}).`);
    } catch (e: any) { toast.error(e.message); } finally { setCnpjBusy(false); }
  };
  const set = (k: keyof typeof f, mask?: 'cpf' | 'cnpj') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: mask ? maskInput(mask, e.target.value) : e.target.value });

  const query = () => buildQuery(kind, f);

  const run = async (e?: React.FormEvent, body?: ReturnType<typeof buildQuery>) => {
    e?.preventDefault();
    setLoading(true); setResult(null); setShown(100); setYear('');
    try { setResult(await api('/search', { method: 'POST', body: body || query() })); }
    catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (params.get('q')) run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const monitor = async () => {
    setSaving(true);
    try {
      const q = query();
      if (client) {
        const r = await api(`/clients/${client.id}/monitor`, { method: 'POST', body: { intervalMinutes: interval, purpose, processNumbers: q.processNumbers, oab: q.oab } });
        toast.success(`Rotina do cliente atualizada: ${r.result.newProcesses} processo(s) novo(s) vinculados a ${client.name}.`);
        router.push(`/clientes/detalhe/?id=${client.id}`);
        return;
      }
      const r = await api('/targets', { method: 'POST', body: {
        kind, name: f.name || f.tradeName, document: kind === 'PF' ? f.cpf : f.cnpj, tradeName: f.tradeName, rg: f.rg, motherName: f.motherName,
        fatherName: f.fatherName, partners: q.partners, processNumbers: q.processNumbers, oab: q.oab, usernames: f.usernames || undefined, monitored: true, intervalMinutes: interval, purpose,
      } });
      toast.success('Monitoramento ativado.');
      router.push(`/alvo/?id=${r.id}`);
    } catch (err: any) {
      if (err.body?.id) { toast.info('Já cadastrado. Abrindo o registro existente.'); router.push(`/alvo/?id=${err.body.id}`); }
      else toast.error(err.message);
    } finally { setSaving(false); }
  };

  const foundProcesses = result?.results.flatMap((r: any) => r.processes.map((p: any) => ({ ...p, source: r.connectorName}))) || [];
  const allProcesses = year ? foundProcesses.filter((p: any) => cnjYear(p.number) === year) : foundProcesses;
  const records = result?.results.flatMap((r: any) => (r.records || []).map((x: any) => ({ ...x, source: r.connectorName }))) || [];
  const registry = result?.results.find((r: any) => r.registry)?.registry;

  return (
    <>
      <PageHeader title="Pesquisa" description="Consulte pessoas físicas e jurídicas em todas as fontes configuradas." />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardContent className="pt-5">
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(['PF', 'PJ'] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)} className={cn('flex items-center justify-center gap-2 rounded-md py-1.5 text-sm cursor-pointer', kind === k ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}>
                  {k === 'PF' ? <User className="size-4" /> : <Building2 className="size-4" />}{k === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}
                </button>
              ))}
            </div>
            <form onSubmit={run} className="space-y-3">
              <ClientPicker value={client} onChange={pickClient} />
              {kind === 'PF' ? (
                <>
                  <Field label="Nome completo"><Input value={f.name} onChange={set('name')} autoFocus /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CPF"><Input value={f.cpf} onChange={set('cpf', 'cpf')} inputMode="numeric" placeholder="000.000.000-00" /></Field>
                    <Field label="RG"><Input value={f.rg} onChange={set('rg')} /></Field>
                  </div>
                  <Field label="Nome da mãe"><Input value={f.motherName} onChange={set('motherName')} /></Field>
                  <Field label="Nome do pai"><Input value={f.fatherName} onChange={set('fatherName')} /></Field>
                  <Field label="OAB (se for advogado)" hint="Ex.: 12345/PA — busca intimações no DJEN."><Input value={f.oab} onChange={set('oab')} placeholder="12345/UF" /></Field>
                  <Field label="Nomes de usuário (redes sociais)" hint="Opcional. Ex.: @fulano, fulano.silva — separe por vírgula."><Input value={f.usernames} onChange={set('usernames')} placeholder="@usuario" /></Field>
                </>
              ) : (
                <>
                  <Field label="CNPJ" hint="Digite o CNPJ e clique em Buscar dados para preencher o restante.">
                    <div className="flex gap-2"><Input value={f.cnpj} onChange={set('cnpj', 'cnpj')} inputMode="numeric" placeholder="00.000.000/0000-00" autoFocus />
                      <Button type="button" variant="outline" loading={cnpjBusy} disabled={f.cnpj.replace(/\D/g, '').length !== 14} onClick={fillCnpj}>Buscar dados</Button></div>
                  </Field>
                  <Field label="Razão social"><Input value={f.name} onChange={set('name')} /></Field>
                  <Field label="Nome fantasia"><Input value={f.tradeName} onChange={set('tradeName')} /></Field>
                  <Field label="Sócios" hint="Um por linha."><Textarea value={f.partners} onChange={set('partners')} rows={2} /></Field>
                </>
              )}
              <Field label="Números de processo (CNJ)" hint="Opcional. Um por linha. Consultados no DJEN (publicações de todos os tribunais).">
                <Textarea value={f.numbers} onChange={set('numbers')} rows={2} placeholder="0000000-00.0000.0.00.0000" />
              </Field>
              <Button className="w-full" loading={loading}><Search />Pesquisar</Button>
            </form>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {!result && !loading && (
            <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
              <FileSearch className="mx-auto mb-3 size-8 opacity-40" />Preencha os dados e clique em Pesquisar.
              <p className="mx-auto mt-2 max-w-md text-xs">Consulta principalmente o <strong>DJEN</strong> — diário dos tribunais (por nome, OAB e número) — além dos diários municipais e dados de CNPJ; Diário Oficial da União, diários estaduais, Portal da Transparência e buscadores vêm como buscas prontas. Escolha um cliente cadastrado para vincular os resultados à rotina dele.</p>
            </CardContent></Card>
          )}
          {loading && <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">{client ? `Consultando todas as bases para ${client.name}: DJEN, diários oficiais, Receita Federal e redes…` : 'Consultando o DJEN e as demais fontes…'}</CardContent></Card>}

          {result && (
            <>
              <Card>
                <CardHeader>
                  <div><CardTitle>Fontes consultadas</CardTitle><CardDescription>{result.results.filter((r: any) => !r.skipped).length} de {result.results.length} aplicáveis</CardDescription></div>
                  <BnmpButton name={f.name} cpf={kind === 'PF' ? f.cpf : undefined} size="sm" />
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border text-sm">
                    {result.results.map((r: any) => (
                      <li key={r.connectorId} className="flex items-start gap-3 py-2">
                        {r.skipped ? <AlertCircle className="mt-0.5 size-4 text-muted-foreground" /> : r.ok ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : <XCircle className="mt-0.5 size-4 text-danger" />}
                        <div className="flex-1"><div className="font-medium">{r.connectorName}</div>{r.message && <div className="text-xs text-muted-foreground">{r.message}</div>}</div>
                        {!r.skipped && r.ok && <Badge>{r.processes.length} proc. · {r.records?.length || 0} reg.</Badge>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {foundProcesses.length === 0 && (
                <Card className="border-gold/40">
                  <CardContent className="flex gap-3 pt-5">
                    <Lock className="mt-0.5 size-5 shrink-0 text-gold" />
                    <div className="text-sm">
                      <p className="text-base font-semibold">0 (zero) processos encontrados</p>
                      <p className="mt-1 text-muted-foreground">Podem existir <strong>processos que tramitam em sigilo</strong> (segredo de justiça), que não aparecem em consultas públicas. Este resultado não equivale a certidão negativa; para confirmar, solicite certidões de distribuição nos tribunais competentes.</p>
                      <div className="mt-3"><BnmpButton name={f.name} cpf={kind === 'PF' ? f.cpf : undefined} size="sm" /></div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {registry && (
                <Card>
                  <CardHeader><CardTitle>Dados cadastrais — Receita Federal</CardTitle></CardHeader>
                  <CardContent>
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      {[['Razão social', registry.razaoSocial], ['Nome fantasia', registry.nomeFantasia], ['Situação', registry.situacao], ['Abertura', fmtDate(registry.abertura)], ['Atividade', registry.atividadePrincipal], ['Capital social', fmtMoney(registry.capitalSocial)], ['Endereço', registry.endereco]].map(([k, v]) => (
                        <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v || '—'}</dd></div>
                      ))}
                    </dl>
                    {registry.socios?.length > 0 && <div className="mt-4"><div className="mb-1 text-xs font-medium">Quadro societário</div>
                      <ul className="text-sm">{registry.socios.map((s: any) => <li key={s.nome}>{s.nome} <span className="text-muted-foreground">— {s.qualificacao}</span></li>)}</ul></div>}
                  </CardContent>
                </Card>
              )}

              {foundProcesses.length > 0 && (
                <Card>
                  <CardHeader><div><CardTitle>Processos ({allProcesses.length}{year ? ` de ${foundProcesses.length}` : ''})</CardTitle></div>
                    <Select className="h-8 w-44 text-xs" value={year} onChange={(e) => { setYear(e.target.value); setShown(100); }} aria-label="Filtrar processos por ano">
                      <option value="">Todos os anos</option>
                      {yearsOf(foundProcesses).map(([y, n]) => <option key={y} value={y}>{y} ({n})</option>)}
                    </Select></CardHeader>
                  <CardContent className="px-0">
                    <Table>
                      <thead><tr><Th>Número</Th><Th>Tribunal / Vara</Th><Th>Classe / Autor / Réu</Th><Th>Situação</Th><Th>Última publicação/movimentação</Th></tr></thead>
                      <tbody>{allProcesses.slice(0, shown).map((p: any) => (
                        <tr key={p.number + p.source}>
                          <Td className="whitespace-nowrap font-mono text-xs">{p.number}<div className="mt-1 font-sans"><LinkToClientButton number={p.number} variant="link" parties={p.parties} document={kind === 'PF' ? f.cpf : f.cnpj} preferred={client} /></div></Td>
                          <Td><CourtTag court={p.court} /><div className="mt-1 text-xs text-muted-foreground">{p.organ}</div>{p.docCheck && <div className="mt-1"><DocTag status={p.docCheck.status} found={p.docCheck.found} /></div>}</Td>
                          <Td className="max-w-72">{p.className}
                            <PartiesLines parties={p.parties} />
                            {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline">Ver publicação <ExternalLink className="size-3" /></a>}
                          </Td>
                          <Td><Badge tone={p.status === 'ativo' ? 'green' : 'neutral'}>{p.status || 'ativo'}</Badge></Td>
                          <Td className="max-w-md text-xs"><span className="line-clamp-3">{p.movements[0] ? <>{fmtDate(p.movements[0].date)} — {p.movements[0].description}</> : '—'}</span></Td>
                        </tr>
                      ))}</tbody>
                    </Table>
                    {allProcesses.length > shown && (
                      <div className="border-t border-border p-3 text-center">
                        <Button variant="outline" size="sm" onClick={() => setShown((n) => n + 100)}>Mostrar mais ({allProcesses.length - shown} restantes)</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {records.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Outros registros ({records.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {records.map((r: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{r.title}</span>{r.severity === 'critico' && <Badge tone="red">sanção</Badge>}<span className="text-xs text-muted-foreground">{fmtDate(r.date)} · {r.source}</span></div>
                        {r.detail && <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>}
                        {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">Abrir publicação <ExternalLink className="size-3" /></a>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className="border-primary/30">
                <CardHeader><div><CardTitle>{client ? `Monitorar e vincular a ${client.name}` : 'Monitorar continuamente'}</CardTitle><CardDescription>{client ? 'Entra na rotina do cliente: processos, movimentações e intimações encontrados ficam vinculados ao cadastro dele.' : 'Salva a pessoa/empresa e avisa sobre novos processos, movimentações e intimações.'}</CardDescription></div></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
                  <Field label="Atualizar a cada">
                    <Select value={interval} onChange={(e) => setInterval_(Number(e.target.value))}>
                      {Object.entries(INTERVAL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                  </Field>
                  <Field label="Finalidade (LGPD)"><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Ex.: due diligence para contrato de locação" /></Field>
                  <Button onClick={monitor} loading={saving}><Radar />{client ? 'Monitorar e vincular' : 'Monitorar'}</Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Consultas registradas na auditoria. Use apenas para finalidades legítimas, nos termos da LGPD. <Link href="/fontes/" className="underline">Ver fontes e cobertura</Link>.</p>
    </>
  );
}

export default function SearchPage() {
  return <Suspense><SearchInner /></Suspense>;
}
