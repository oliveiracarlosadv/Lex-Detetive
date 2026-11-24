'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Archive, Bot, Camera, Info, Database, Download, ExternalLink, HardDrive, ImagePlus, KeyRound, Lock, PlugZap, Server, ShieldCheck, Smartphone, Trash2, Upload, UserRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PageHeader, Skeleton, Switch, Table, Tabs, Td, Th } from '@/components/ui/misc';
import { api, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { LogoMark } from '@/components/logo';
import { InstallSteps } from '@/components/install-app';
import { initials, shrinkImage } from '@/lib/image';

/** Botão que abre a página oficial para criar a chave (no app desktop abre o navegador padrão). */
function KeyLink({ href, children, variant = 'outline' }: { href: string; children: React.ReactNode; variant?: 'outline' | 'gold' }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={variant === 'gold'
        ? 'inline-flex h-9 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-navy shadow-sm hover:brightness-105'
        : 'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted'}>
      {children}<ExternalLink className="size-4 opacity-70" />
    </a>
  );
}

type Tab = 'perfil' | 'ia' | 'fontes' | 'seguranca' | 'backup' | 'sistema' | 'instalar' | 'sobre';
const secret = (v: any) => typeof v === 'object' && v?.configured;

function useSettings() {
  const { data, reload } = useApi<any>('/settings');
  const save = async (patch: Record<string, string | null>) => {
    try { await api('/settings', { method: 'PUT', body: patch }); toast.success('Configurações salvas.'); reload(true); }
    catch (e: any) { toast.error(e.message); }
  };
  return { s: data?.settings, data, save, reload };
}

const ACTIVITIES = ['Advogado(a)', 'Advogado(a) associado(a)', 'Estagiário(a) de Direito', 'Perito(a) judicial', 'Investigador(a) particular', 'Contador(a)', 'Analista de compliance', 'Assistente jurídico(a)'];
const REGISTRIES = ['OAB', 'CRC', 'CREA', 'CRA', 'CRECI', 'CRM', 'CRP', 'Outro'];
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SE SP TO'.split(' ');

function ProfileTab() {
  const { user, refresh } = useAuth();
  const [f, setF] = useState({ name: '', office: '', activity: '', registryType: '', registryNumber: '', registryUf: '' });
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!user) return;
    setF({ name: user.name || '', office: user.office || '', activity: user.activity || '', registryType: user.registryType || '', registryNumber: user.registryNumber || '', registryUf: user.registryUf || '' });
    api('/auth/profile/logo').then((r) => setLogo(r.dataUrl)).catch(() => undefined);
  }, [user]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await api('/auth/profile', { method: 'PATCH', body: f }); toast.success('Perfil salvo.'); refresh(); }
    catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) return toast.error('Envie a logomarca em PNG ou JPG.');
    try { const dataUrl = await shrinkImage(file); await api('/auth/profile/logo', { method: 'POST', body: { dataUrl } }); setLogo(dataUrl); toast.success('Logomarca atualizada. Ela aparece no cabeçalho dos relatórios.'); }
    catch (err: any) { toast.error(err.message); }
  };
  const removeLogo = async () => { await api('/auth/profile/logo', { method: 'POST', body: { dataUrl: null } }); setLogo(null); };
  const setPhoto = async (file?: File) => {
    if (!file) return;
    try { await api('/auth/profile', { method: 'PATCH', body: { photo: await shrinkImage(file, 256, true) } }); toast.success('Foto atualizada.'); refresh(); }
    catch (err: any) { toast.error(err.message); }
  };
  const registry = f.registryType && f.registryNumber ? `${f.registryType}${f.registryUf ? `/${f.registryUf}` : ''} ${f.registryNumber}` : '';
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card><CardHeader><div><CardTitle>Meu perfil</CardTitle><CardDescription>Estes dados aparecem na assinatura e no cabeçalho dos relatórios.</CardDescription></div></CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            {user?.photo ? <img src={user.photo} alt="Sua foto" className="size-16 rounded-full object-cover" /> : <div className="flex size-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">{initials(user?.name)}</div>}
            <div className="flex gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted"><Camera className="size-4" />{user?.photo ? 'Trocar foto' : 'Adicionar foto'}
                <input type="file" accept="image/*" hidden onChange={(e) => { setPhoto(e.target.files?.[0]); e.target.value = ''; }} /></label>
              {user?.photo && <Button variant="ghost" onClick={async () => { await api('/auth/profile', { method: 'PATCH', body: { photo: null } }); refresh(); }}><Trash2 />Remover</Button>}
            </div>
          </div>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-6">
            <Field className="sm:col-span-6" label="Nome completo"><Input required value={f.name} onChange={set('name')} /></Field>
            <Field className="sm:col-span-6" label="Escritório / empresa" hint="Se vazio, usa o nome definido em Sistema."><Input value={f.office} onChange={set('office')} placeholder="Ex.: Oliveira Advocacia" /></Field>
            <Field className="sm:col-span-6" label="Atividade">
              <Input list="atividades" value={f.activity} onChange={set('activity')} placeholder="Ex.: Advogado(a)" />
              <datalist id="atividades">{ACTIVITIES.map((a) => <option key={a} value={a} />)}</datalist>
            </Field>
            <Field className="sm:col-span-2" label="Tipo de registro"><Select value={f.registryType} onChange={set('registryType')}><option value="">Nenhum</option>{REGISTRIES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
            <Field className="sm:col-span-2" label="Número do registro"><Input value={f.registryNumber} onChange={set('registryNumber')} placeholder="Ex.: 12.345" /></Field>
            <Field className="sm:col-span-2" label="UF"><Select value={f.registryUf} onChange={set('registryUf')}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
            <div className="sm:col-span-6"><Button loading={saving}>Salvar perfil</Button></div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card><CardHeader><div><CardTitle>Logomarca dos relatórios</CardTitle><CardDescription>PNG ou JPG. Aparece no cabeçalho de todas as páginas.</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border bg-white p-3">
              {logo ? <img src={logo} alt="Logomarca do escritório" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sem logomarca (usa a do Lex Detetive)</span>}
            </div>
            <div className="flex gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
                <ImagePlus className="size-4" />{logo ? 'Trocar' : 'Enviar logomarca'}
                <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {logo && <Button variant="ghost" onClick={removeLogo}><Trash2 />Remover</Button>}
            </div>
          </CardContent>
        </Card>
        <Card><CardHeader><div><CardTitle>Como sai a assinatura</CardTitle></div></CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-white p-4 text-center font-[Arial,Helvetica,sans-serif] text-[12pt] text-black">
              <div className="mx-auto mb-1 w-48 border-t border-black" />
              <div className="font-bold">{f.name || 'Seu nome'}</div>
              {f.activity && <div>{f.activity}</div>}
              {registry && <div>{registry}</div>}
              <div>{f.office || 'Escritório'}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AiTab() {
  const { s, save } = useSettings();
  const { data: providers, reload } = useApi<any[]>('/ai/providers');
  const { data: hw } = useApi<{ ramGb: number; cpuCores: number; lowEnd: boolean; localAiOk: boolean }>('/ai/hardware');
  const [sel, setSel] = useState('');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  useEffect(() => { if (s && !sel) setSel(s['ai.provider']); }, [s, sel]);
  const p = providers?.find((x) => x.id === sel);
  useEffect(() => {
    if (!p) return;
    setModel(p.model || ''); setBaseUrl(p.local ? p.baseUrl || '' : ''); setKey('');
    if (p.local) api(`/ai/models?provider=${p.id}`).then((r) => setModels(r.models || [])); else setModels([]);
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s || !providers) return <Skeleton className="h-60" />;
  const apply = async () => {
    const patch: Record<string, string | null> = { 'ai.provider': sel, [`ai.model.${sel}`]: model };
    if (p?.local && baseUrl) patch[`ai.baseUrl.${sel}`] = baseUrl;
    if (key) patch[`ai.key.${sel}`] = key;
    await save(patch); reload(true); setKey('');
  };
  const test = async () => { setTesting(true); const r = await api('/ai/test', { method: 'POST', body: { provider: sel } }); setTesting(false); r.ok ? toast.success(`${r.provider} respondeu em ${r.ms} ms: "${r.reply}"`) : toast.error(r.error); };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card><CardHeader><div><CardTitle>Provedor de IA</CardTitle><CardDescription>Local (sem internet, dados não saem do computador) ou nuvem (com chave de API)</CardDescription></div></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {providers.map((x) => (
            <button key={x.id} onClick={() => setSel(x.id)} className={`rounded-lg border p-3 text-left text-sm cursor-pointer ${sel === x.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-input'}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{x.name}</span><span className="flex gap-1">{x.heavy && <Badge tone="red">pesada p/ este PC</Badge>}{x.free && !x.heavy && <Badge tone="gold">grátis</Badge>}{x.active && <Badge tone="green">em uso</Badge>}</span></div>
              <div className="mt-1 text-xs text-muted-foreground">{x.local ? 'Local' : x.hasKey ? 'Chave configurada' : 'Requer chave'} · {x.model}</div>
            </button>
          ))}
        </CardContent>
      </Card>
      <Card className="h-fit"><CardHeader><CardTitle>{p?.name}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Modelo" hint={p?.local && !models.length ? 'Nenhum modelo encontrado. O servidor local está aberto?' : undefined}>
            {models.length ? <Select value={model} onChange={(e) => setModel(e.target.value)}>{[...new Set([model, ...models])].filter(Boolean).map((m) => <option key={m}>{m}</option>)}</Select> : <Input value={model} onChange={(e) => setModel(e.target.value)} />}
          </Field>
          {p?.local && <p className="text-xs text-muted-foreground">{p.personal}</p>}
          {p?.id === 'ollama' && (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs">
              <strong>Para usar o Ollama pelo navegador</strong>, libere o acesso do site uma vez no computador onde o Ollama roda:
              no Mac/Linux, no Terminal: <code className="break-all">launchctl setenv OLLAMA_ORIGINS &quot;*&quot;</code> (Mac) ou defina <code>OLLAMA_ORIGINS=*</code>; no Windows, crie a variável de ambiente <code>OLLAMA_ORIGINS</code> com valor <code>*</code>. Depois feche e abra o Ollama.
            </div>
          )}
          {p?.heavy && hw && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs">
              <strong>Este computador tem {hw.ramGb} GB de memória.</strong> A IA local precisa de pelo menos 8 GB e deixaria o sistema lento.
              Recomendado: <button type="button" className="font-semibold text-primary underline cursor-pointer" onClick={() => setSel('gemini')}>Google Gemini</button> (gratuito, roda na nuvem sem ocupar memória).
              Se mantiver a IA local, o resumo automático dos alertas é feito por regras para não travar o computador.
            </div>
          )}
          {p?.local && <Field label="Endereço do servidor"><Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></Field>}
          {p?.needsKey && (
            <>
              <Field label="Chave de API" hint={p.hasKey ? 'Já configurada. Preencha só para trocar.' : 'Fica guardada só neste navegador.'}><Input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></Field>
              {!p.hasKey && <p className="text-xs text-muted-foreground">Ainda não tem chave? {p.personal}</p>}
            </>
          )}
          {p && (
            <div className="flex flex-wrap gap-2">
              <KeyLink href={p.keyUrl} variant={p.needsKey && !p.hasKey ? 'gold' : 'outline'}><KeyRound className="size-4" />{p.keyLabel}</KeyLink>
              {p.modelsUrl && <KeyLink href={p.modelsUrl}>Ver modelos</KeyLink>}
            </div>
          )}
          <div className="flex gap-2"><Button onClick={apply}>Usar este provedor</Button><Button variant="outline" onClick={test} loading={testing}><PlugZap />Testar</Button></div>
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm"><span>Resumo automático de movimentações e intimações</span><Switch checked={s['ai.autoSummary'] === 'true'} onChange={(v) => save({ 'ai.autoSummary': String(v) })} /></div>
        </CardContent>
      </Card>
    </div>
  );
}

function SourcesTab() {
  const { s, save } = useSettings();
  const [sx, setSx] = useState<string | null>(null); const [ufs, setUfs] = useState<string | null>(null);
  if (!s) return <Skeleton className="h-40" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2"><CardHeader><div><CardTitle>Como as fontes funcionam no navegador</CardTitle><CardDescription>As consultas saem direto deste aparelho para as fontes oficiais.</CardDescription></div></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div><div className="mb-1 font-medium">Automáticas</div><p className="text-muted-foreground">DJEN (intimações e publicações dos tribunais), Querido Diário (diários municipais), BrasilAPI e CNPJá (CNPJ), GitHub, Bluesky, Mastodon e GitLab.</p></div>
          <div><div className="mb-1 font-medium">Buscas prontas (um clique)</div><p className="text-muted-foreground">Diário Oficial da União, Diários Oficiais dos Estados, Portal da Transparência (sanções), Google, Bing, DuckDuckGo, Yandex e redes que exigem login. Esses sites não permitem consulta automática pelo navegador.</p></div>
        </CardContent></Card>
      <Card><CardHeader><div><CardTitle>Diários Oficiais dos Estados</CardTitle><CardDescription>Estados cujos Diários Oficiais entram nas buscas prontas (siglas separadas por vírgula). Os estados dos tribunais onde o pesquisado tem processos entram automaticamente.</CardDescription></div></CardHeader>
        <CardContent className="flex gap-2"><Input placeholder="PA, AP, AM" value={ufs ?? s['diarios.ufs'] ?? 'PA'} onChange={(e) => setUfs(e.target.value.toUpperCase())} />
          <Button onClick={() => { save({ 'diarios.ufs': (ufs ?? '').trim() || 'PA' }); setUfs(null); }} disabled={ufs === null}>Salvar</Button></CardContent></Card>
      <Card><CardHeader><div><CardTitle>Metabuscador SearXNG (opcional)</CardTitle><CardDescription>Endereço de um servidor SearXNG próprio, com formato JSON e acesso pelo navegador liberados: ele consulta Google, Bing, DuckDuckGo e outros ao mesmo tempo e traz os resultados para dentro do app.</CardDescription></div>{s['busca.searxngUrl'] && <Badge tone="green">configurado</Badge>}</CardHeader>
        <CardContent className="flex gap-2"><Input placeholder="http://127.0.0.1:8080" value={sx ?? s['busca.searxngUrl'] ?? ''} onChange={(e) => setSx(e.target.value)} />
          <Button onClick={() => { save({ 'busca.searxngUrl': (sx ?? '').trim() }); setSx(null); }} disabled={sx === null}>Salvar</Button></CardContent></Card>
    </div>
  );
}

function SecurityTab() {
  const { hasPassword, refresh } = useAuth();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (remove = false) => {
    if (!remove && pw.next !== pw.confirm) return toast.error('As senhas não conferem.');
    setBusy(true);
    try {
      const r = await api('/auth/password', { method: 'POST', body: { current: pw.current, next: remove ? null : pw.next } });
      toast.success(r.hasPassword ? 'Senha de bloqueio salva. Ela será pedida ao abrir o app.' : 'Senha de bloqueio removida.');
      setPw({ current: '', next: '', confirm: '' }); refresh();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><div><CardTitle>Senha de bloqueio</CardTitle><CardDescription>Opcional. Quando ligada, o app pede a senha ao ser aberto neste navegador. Útil se outras pessoas usam o mesmo aparelho.</CardDescription></div><Badge tone={hasPassword ? 'green' : 'neutral'}>{hasPassword ? 'ligada' : 'desligada'}</Badge></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
            {hasPassword && <Field label="Senha atual"><Input type="password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></Field>}
            <Field label={hasPassword ? 'Nova senha' : 'Senha'} hint="Mínimo de 6 caracteres."><Input type="password" required minLength={6} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></Field>
            <Field label="Confirme a senha"><Input type="password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></Field>
            <div className="flex flex-wrap gap-2">
              <Button loading={busy}><Lock />{hasPassword ? 'Trocar senha' : 'Ligar senha de bloqueio'}</Button>
              {hasPassword && <Button type="button" variant="outline" onClick={() => { if (!pw.current) return toast.error('Informe a senha atual.'); submit(true); }}>Remover senha</Button>}
            </div>
          </form>
        </CardContent></Card>
      <Card className="h-fit"><CardHeader><div><CardTitle>Privacidade</CardTitle></div></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Os dados ficam só neste navegador; não há servidor da Lex Tecnologias guardando informações.</p>
          <p>Não há como recuperar a senha de bloqueio. Mantenha um backup atualizado (aba Backup).</p>
          <p>Chaves de API (Lex AI) ficam guardadas neste navegador e não vão para o arquivo de backup.</p>
        </CardContent></Card>
    </div>
  );
}

function BackupTab() {
  const [busy, setBusy] = useState<'' | 'export' | 'import'>('');
  const doExport = async () => { setBusy('export'); try { const r = await api('/backups', { method: 'POST', body: {} }); toast.success(`Backup salvo: ${r.name}`); } catch (e: any) { toast.error(e.message); } finally { setBusy(''); } };
  const doImport = async (file?: File) => {
    if (!file) return;
    if (!confirm('Importar este backup?\n\nTODOS os dados atuais deste navegador serão substituídos pelos do arquivo. Se quiser, exporte um backup dos dados atuais antes.')) return;
    setBusy('import');
    try {
      const r = await api('/backups/import', { method: 'POST', body: { text: await file.text() } });
      toast.success(`Backup importado: ${r.counts.targets} monitorado(s), ${r.counts.clients} cliente(s), ${r.counts.processes} processo(s).`);
      setTimeout(() => location.reload(), 1200);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(''); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><div><CardTitle>Exportar backup</CardTitle><CardDescription>Baixa um arquivo com todos os dados deste navegador: monitorados, processos, alertas, clientes, relatórios e configurações.</CardDescription></div></CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={doExport} loading={busy === 'export'}><Download />Exportar backup</Button>
          <p className="text-xs text-muted-foreground">Guarde o arquivo em local seguro (ex.: Google Drive). Ele contém dados pessoais (LGPD). As chaves de API não vão no arquivo.</p>
        </CardContent></Card>
      <Card><CardHeader><div><CardTitle>Importar backup</CardTitle><CardDescription>Restaura um arquivo exportado antes, neste ou em outro aparelho. Substitui os dados atuais deste navegador.</CardDescription></div></CardHeader>
        <CardContent className="space-y-3">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Upload className="size-4" />{busy === 'import' ? 'Importando…' : 'Escolher arquivo de backup'}
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <p className="text-xs text-muted-foreground">Use para levar os dados para o celular ou para outro computador.</p>
        </CardContent></Card>
    </div>
  );
}

function SystemTab() {
  const { s, data, save } = useSettings();
  const { data: st, reload: reloadSt } = useApi<{ usedMb: number | null; quotaMb: number | null; persisted: boolean }>('/storage');
  const [org, setOrg] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  useEffect(() => { if (s && org === null) { setOrg(s['org.name']); setCity(s['org.city'] || ''); } }, [s, org]);
  if (!s) return <Skeleton className="h-40" />;
  const row = (label: string, desc: string, key: string) => (
    <div className="flex items-center justify-between gap-4 py-3"><div><div className="text-sm font-medium">{label}</div><div className="text-xs text-muted-foreground">{desc}</div></div><Switch checked={s[key] === 'true'} onChange={(v) => save({ [key]: String(v) })} /></div>
  );
  const persist = async () => { const r = await api('/storage/persist', { method: 'POST' }); r.persisted ? toast.success('Pronto: o navegador não vai apagar os dados sozinho.') : toast.info('O navegador não liberou. Instale o app (aba Instalar) e tente de novo.'); reloadSt(true); };
  const erase = async () => {
    if (!confirm('Apagar TODOS os monitorados, processos, alertas e clientes deste navegador?\n\nNão dá para desfazer. Exporte um backup antes, se quiser guardar.')) return;
    await api('/data/erase', { method: 'POST' }); toast.success('Dados apagados.'); setTimeout(() => location.reload(), 800);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Preferências</CardTitle></CardHeader><CardContent className="divide-y divide-border">
        {row('Monitoramento automático', 'Verifica os monitorados no intervalo escolhido enquanto o app estiver aberto.', 'monitor.enabled')}
        {row('Mascarar CPF/CNPJ', 'Exibe documentos parcialmente ocultos (LGPD). Visualizar completo fica registrado na auditoria.', 'privacy.maskDocuments')}
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <Field label="Nome do escritório nos relatórios"><Input value={org ?? ''} onChange={(e) => setOrg(e.target.value)} /></Field>
          <Field label="Cidade (assinatura)"><Input value={city ?? ''} placeholder="Ex.: Belém/PA" onChange={(e) => setCity(e.target.value)} /></Field>
          <Button variant="outline" onClick={() => save({ 'org.name': org, 'org.city': city || null })}>Salvar</Button>
        </div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Armazenamento</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <div className="flex gap-2"><HardDrive className="size-4 text-muted-foreground" />Dados guardados em: {data?.dataDir}</div>
        <div className="flex gap-2"><Database className="size-4 text-muted-foreground" />Espaço usado: {st?.usedMb != null ? `${st.usedMb} MB` : '—'}{st?.quotaMb ? ` de ${st.quotaMb} MB disponíveis` : ''}</div>
        <div className="flex gap-2"><Server className="size-4 text-muted-foreground" />Monitoramento: {data?.queue?.queued ?? 0} na fila, {data?.queue?.running ?? 0} em execução</div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
          <span>{st?.persisted ? 'Dados protegidos contra limpeza automática do navegador.' : 'O navegador pode apagar os dados se faltar espaço.'}</span>
          {!st?.persisted && <Button size="sm" variant="outline" onClick={persist}>Proteger</Button>}
        </div>
        <Button variant="ghost" className="text-danger" onClick={erase}><Trash2 />Apagar todos os dados deste navegador</Button>
      </CardContent></Card>
    </div>
  );
}

function AboutTab() {
  const { data: health } = useApi<{ version: string }>('/health');
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-2.5 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
  );
  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <div className="mb-5 flex items-center gap-4">
          <LogoMark className="size-16" />
          <div><div className="text-xl font-semibold">Lex Detetive</div><div className="text-sm text-muted-foreground">Monitoramento jurídico e investigação processual</div></div>
        </div>
        <dl className="divide-y divide-border">
          {row('Versão', health?.version ? <Badge>{`v${health.version}`}</Badge> : '—')}
          {row('Desenvolvedor', 'Lex Tecnologias')}
          {row('Ambiente', 'Aplicativo web (PWA) — roda no navegador')}
          {row('Fonte principal', 'DJEN — Diário de Justiça Eletrônico Nacional (CNJ)')}
          {row('Onde ficam os dados', 'Somente neste navegador')}
          {row('Atualização', 'Automática ao abrir o app com internet')}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">© {new Date().getFullYear()} Lex Tecnologias. Os dados ficam armazenados localmente neste navegador e não são enviados à Lex Tecnologias.</p>
      </CardContent>
    </Card>
  );
}

function SettingsInner() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('aba') as Tab) || 'perfil');
  const items = [
    { value: 'perfil' as Tab, label: 'Meu perfil', icon: UserRound },
    { value: 'ia' as Tab, label: 'Lex AI', icon: Bot },
    { value: 'fontes' as Tab, label: 'Fontes', icon: PlugZap },
    { value: 'seguranca' as Tab, label: 'Segurança', icon: ShieldCheck },
    { value: 'backup' as Tab, label: 'Backup', icon: Archive },
    { value: 'sistema' as Tab, label: 'Sistema', icon: Server },
    { value: 'instalar' as Tab, label: 'Instalar', icon: Smartphone },
    { value: 'sobre' as Tab, label: 'Sobre', icon: Info },
  ];
  return (
    <>
      <PageHeader title="Configurações" />
      <Tabs value={tab} onChange={setTab} items={items} />
      <div className="mt-4">
        {tab === 'perfil' && <ProfileTab />}{tab === 'ia' && <AiTab />}{tab === 'fontes' && <SourcesTab />}
        {tab === 'seguranca' && <SecurityTab />}{tab === 'backup' && <BackupTab />}{tab === 'sistema' && <SystemTab />}
        {tab === 'instalar' && <Card className="max-w-xl"><CardHeader><div><CardTitle>Instalar o Lex Detetive</CardTitle><CardDescription>Use como aplicativo no celular ou no computador.</CardDescription></div></CardHeader><CardContent><InstallSteps /></CardContent></Card>}
        {tab === 'sobre' && <AboutTab />}
      </div>
    </>
  );
}

export default function SettingsPage() { return <Suspense><SettingsInner /></Suspense>; }
