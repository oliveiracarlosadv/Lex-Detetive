'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Building2, DatabaseZap, FileSearch, Eye, Globe, Link2, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Radar, Scale, Trash2, Unlink, User, AtSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Select } from '@/components/ui/input';
import { Dialog, Empty, Skeleton, Table, Tabs, Td, Th } from '@/components/ui/misc';
import { ClientFormDialog } from '@/components/client-form';
import { PartiesLines } from '@/components/parties-lines';
import { CourtTag, DocTag } from '@/components/process-tags';
import { BnmpButton } from '@/components/bnmp-button';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtMoney, maskInput } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth';

const ROLES = ['autor', 'réu', 'terceiro', 'interessado', 'parte'];

function LinkDialog({ clientId, open, onClose, onLinked }: { clientId: string; open: boolean; onClose: () => void; onLinked: () => void }) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('parte');
  const [results, setResults] = useState<any[]>([]);
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => api<any[]>(`/processes?q=${encodeURIComponent(q)}`).then(setResults).catch(() => setResults([])), 200);
    return () => clearTimeout(t);
  }, [q, open]);
  const link = async (body: any, key: string) => {
    setBusy(key);
    try { await api(`/clients/${clientId}/processes`, { method: 'POST', body: { ...body, role } }); toast.success('Processo vinculado ao cliente.'); onLinked(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(''); }
  };
  return (
    <Dialog open={open} onClose={onClose} wide title="Vincular processo ao cliente" description="Escolha um processo já cadastrado/encontrado no sistema ou informe um número novo.">
      <div className="space-y-4">
        <Field label="Papel do cliente no processo"><Select value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-56">{ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 text-sm font-medium">Número novo (consulta no DJEN)</div>
          <div className="flex gap-2"><Input value={number} placeholder="0000000-00.0000.0.00.0000" onChange={(e) => setNumber(maskInput('cnj', e.target.value))} />
            <Button onClick={() => link({ number }, 'new')} loading={busy === 'new'} disabled={number.replace(/\D/g, '').length !== 20}><Plus />Vincular</Button></div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium">Processos cadastrados e encontrados</div>
          <Input placeholder="Filtrar por número, classe ou nome da pessoa/empresa" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-2 max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {results.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1"><div className="font-mono text-xs">{p.number}</div><div className="truncate text-xs text-muted-foreground">{p.court} · {p.className} · {p.target?.name}</div></div>
                <Button size="sm" variant="outline" onClick={() => link({ processId: p.id }, p.id)} loading={busy === p.id}><Link2 />Vincular</Button>
              </li>
            ))}
            {!results.length && <li className="px-3 py-6 text-center text-xs text-muted-foreground">0 (zero) processos encontrados. Podem existir processos em sigilo.</li>}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}

function ClientInner() {
  const id = useSearchParams().get('id')!;
  const router = useRouter();
  const { user } = useAuth();
  const [reveal, setReveal] = useState(false);
  const [tab, setTab] = useState<'dados' | 'processos' | 'emails'>('dados');
  const [edit, setEdit] = useState(false);
  const [linking, setLinking] = useState(false);
  const { data: c, reload, setData } = useApi<any>(`/clients/${id}?reveal=${reveal}`, [reveal]);
  const { data: emails } = useApi<any[]>(tab === 'emails' ? `/mail/messages?clientId=${id}` : null, [tab]);
  if (!c) return <Skeleton className="h-96" />;

  const unlink = async (linkId: string) => { if (!confirm('Desvincular este processo do cliente?')) return; setData(await api(`/clients/${id}/processes/${linkId}`, { method: 'DELETE' })); };
  const monitor = async () => {
    if (c.targetId) return router.push(`/alvo/?id=${c.targetId}`);
    const t = toast.loading('Pesquisando nas fontes públicas e ativando a rotina do cliente…');
    try { const r = await api(`/clients/${id}/monitor`, { method: 'POST', body: {} }); toast.success(`Rotina ativada: ${r.result.newProcesses} processo(s) encontrados e vinculados.`, { id: t }); reload(true); }
    catch (e: any) { toast.error(e.message, { id: t }); }
  };
  const remove = async () => { if (!confirm(`Excluir definitivamente o cliente ${c.name}? (LGPD)`)) return; await api(`/clients/${id}`, { method: 'DELETE' }); router.push('/clientes/'); };
  const address = [c.street, c.number, c.complement, c.district, c.city && `${c.city}/${c.state || ''}`, c.zip].filter(Boolean).join(', ');
  const emailsTo = [c.email, c.email2].filter(Boolean);
  const wa = c.whatsapp?.replace(/\D/g, '');

  return (
    <>
      <Link href="/clientes/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Clientes</Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">{c.kind === 'PF' ? <User className="size-6" /> : <Building2 className="size-6" />}</div>
          <div>
            <h1 className="text-xl font-semibold">{c.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge tone={c.status === 'ativo' ? 'green' : 'neutral'}>{c.status}</Badge>
              {c.document && <span className="font-mono">{c.document}</span>}
              {c.document && user?.role !== 'leitor' && <button onClick={() => setReveal(!reveal)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"><Eye className="size-3" />{reveal ? 'ocultar' : 'mostrar'}</button>}
              {c.responsible && <span>· resp.: {c.responsible}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {wa && <a href={`https://wa.me/55${wa}`} target="_blank" rel="noopener noreferrer"><Button variant="outline"><MessageCircle />WhatsApp</Button></a>}
          <Link href={`/pesquisa/?cliente=${id}&consultar=1`} title="Consulta todos os processos do cliente em todos os diários e bases públicas"><Button variant="gold"><DatabaseZap />Consultar bases</Button></Link>
          <Link href={`/pesquisa/?cliente=${id}`}><Button variant="outline"><FileSearch />Pesquisar</Button></Link>
          <Button variant="outline" onClick={() => setEdit(true)}><Pencil />Editar</Button>
          <Button variant="outline" onClick={monitor}><Radar />{c.targetId ? 'Ver monitoramento' : 'Monitorar'}</Button>
          <BnmpButton name={c.name} />
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} items={[{ value: 'dados', label: 'Dados gerais', icon: User }, { value: 'processos', label: `Processos (${c.processes.length})`, icon: Scale }, { value: 'emails', label: 'E-mails', icon: Mail }]} />
      <div className="mt-4">
        {tab === 'dados' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2"><CardHeader><CardTitle>Identificação</CardTitle></CardHeader><CardContent>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {[['Tipo', c.kind === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'], ['Nome fantasia', c.tradeName], ['CPF/CNPJ', c.document], ['RG', c.rg], ['Inscrição estadual', c.stateReg], [c.kind === 'PF' ? 'Nascimento' : 'Abertura', c.birthDate && fmtDate(c.birthDate)], ['Estado civil', c.maritalStatus], ['Profissão', c.profession], ['Nacionalidade', c.nationality], ['Representante', c.contactPerson], ['Responsável', c.responsible], ['Cadastrado em', fmtDateTime(c.createdAt)]].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string}><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
              {c.notes && <div className="mt-4 rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{c.notes}</div>}
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Contato</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              {emailsTo.map((e) => <a key={e} href={`mailto:${e}`} className="flex items-center gap-2 text-primary hover:underline"><Mail className="size-4" />{e}</a>)}
              {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />{c.phone}</a>}
              {c.whatsapp && <div className="flex items-center gap-2"><MessageCircle className="size-4 text-muted-foreground" />{c.whatsapp}</div>}
              {c.usernames && <div className="flex items-start gap-2"><AtSign className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>{c.usernames.split(/,\s*/).map((h: string) => '@' + h).join(', ')}</span></div>}
              {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline"><Globe className="size-4" />{c.website}</a>}
              {address && <div className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 text-muted-foreground" />{address}</div>}
              {!emailsTo.length && !c.phone && !address && <p className="text-muted-foreground">Sem dados de contato.</p>}
            </CardContent></Card>
            {user?.role !== 'leitor' && <div className="lg:col-span-3"><Button variant="ghost" className="text-danger" onClick={remove}><Trash2 />Excluir cliente (LGPD)</Button></div>}
          </div>
        )}
        {tab === 'processos' && (
          <Card>
            <CardHeader><div><CardTitle>Processos do cliente</CardTitle><CardDescription>Vincule processos cadastrados, encontrados nas pesquisas ou por número</CardDescription></div><Button onClick={() => setLinking(true)}><Link2 />Vincular processo</Button></CardHeader>
            {!c.processes.length ? <Empty icon={Scale} title="Nenhum processo vinculado" /> : (
              <Table>
                <thead><tr><Th>Número</Th><Th>Papel</Th><Th>Tribunal / Vara</Th><Th>Classe / Autor / Réu</Th><Th>Valor</Th><Th>Última mov.</Th><Th /></tr></thead>
                <tbody>{c.processes.map((l: any) => (
                  <tr key={l.id} className="hover:bg-muted/40">
                    <Td><Link href={`/processo/?id=${l.process.id}`} className="font-mono text-xs text-primary hover:underline">{l.process.number}</Link></Td>
                    <Td><Badge tone="blue">{l.role}</Badge></Td>
                    <Td><CourtTag court={l.process.court} /><div className="mt-1 text-xs text-muted-foreground">{l.process.organ}</div><div className="mt-1"><DocTag status={l.process.docStatus} found={l.process.docFound} /></div></Td>
                    <Td className="max-w-72">{l.process.className}<PartiesLines parties={l.process.parties} /></Td>
                    <Td className="tabular-nums">{fmtMoney(l.process.value)}</Td>
                    <Td className="text-xs">{fmtDate(l.process.lastMovementAt)}</Td>
                    <Td><Button size="icon" variant="ghost" onClick={() => unlink(l.id)} aria-label="Desvincular" title="Desvincular"><Unlink /></Button></Td>
                  </tr>
                ))}</tbody>
              </Table>
            )}
          </Card>
        )}
        {tab === 'emails' && (
          <Card>{!emails?.length ? <Empty icon={Mail} title="Nenhum e-mail para este cliente" /> : (
            <Table><thead><tr><Th>Assunto</Th><Th>Para</Th><Th>Pasta</Th><Th>Data</Th></tr></thead>
              <tbody>{emails.map((m) => <tr key={m.id}><Td className="font-medium">{m.subject}</Td><Td className="text-xs">{m.to.join(', ')}</Td><Td><Badge>{m.folder}</Badge></Td><Td className="text-xs">{fmtDateTime(m.sentAt || m.updatedAt)}</Td></tr>)}</tbody>
            </Table>
          )}</Card>
        )}
      </div>
      {edit && <ClientFormDialog open client={c} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(true); }} />}
      <LinkDialog clientId={id} open={linking} onClose={() => setLinking(false)} onLinked={() => { setLinking(false); reload(true); }} />
    </>
  );
}

export default function ClientDetail() { return <Suspense><ClientInner /></Suspense>; }
