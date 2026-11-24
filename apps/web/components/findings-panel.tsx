'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { AtSign, ExternalLink, Newspaper, Search, Share2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Empty } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';

type Rec = { title: string; detail?: string; date?: string; url?: string };

/** Último resultado de cada fonte, a partir do histórico de verificações. */
function latest(snapshots: any[], source: string): Rec[] {
  const s = (snapshots || []).find((x) => x.source === source && Array.isArray(x.data));
  return s ? s.data : [];
}

function List({ items, empty }: { items: Rec[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((r, i) => (
        <li key={i} className="py-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.title}</span>
            {r.date && <span className="text-xs text-muted-foreground">{fmtDate(r.date)}</span>}
            {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">abrir <ExternalLink className="size-3" /></a>}
          </div>
          {r.detail && <p className="mt-0.5 text-muted-foreground">{r.detail}</p>}
        </li>
      ))}
    </ul>
  );
}

export function FindingsPanel({ target, canEdit, onChanged }: { target: any; canEdit: boolean; onChanged: () => void }) {
  const [handles, setHandles] = useState<string>(target.usernames || '');
  const [busy, setBusy] = useState(false);
  const social = latest(target.snapshots, 'redes-sociais');
  const found = social.filter((r) => /encontrado$/.test(r.title));
  const manual = social.filter((r) => /conferir manualmente/.test(r.title));
  const same = social.filter((r) => /mesmo nome/.test(r.title));
  const posts = social.filter((r) => /cita/.test(r.title));
  const web = latest(target.snapshots, 'buscadores');
  const webAuto = web.filter((r) => !/— abrir busca por/.test(r.title));
  const webLinks = web.filter((r) => /— abrir busca por/.test(r.title));
  const checkedWeb = (target.lastCheck?.sources || []).some((s: any) => s.id === 'buscadores');
  const doeAll = latest(target.snapshots, 'doe');
  const doe = doeAll.filter((r) => !/— abrir busca/.test(r.title));
  const doeLinks = doeAll.filter((r) => /— abrir busca/.test(r.title));
  const dou = latest(target.snapshots, 'dou');
  const municipal = latest(target.snapshots, 'querido-diario');
  const checkedSocial = (target.lastCheck?.sources || []).some((s: any) => s.id === 'redes-sociais');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/targets/${target.id}`, { method: 'PATCH', body: { usernames: handles } });
      toast.info('Nomes de usuário salvos. Buscando nas redes…');
      await api(`/targets/${target.id}/check`, { method: 'POST' });
      toast.success('Busca concluída.');
      onChanged();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader><div><CardTitle>Redes sociais</CardTitle><CardDescription>Perfis públicos pelo nome de usuário, contas com o mesmo nome e publicações que citam o nome. “Confirmado” quer dizer que o nome de usuário existe na rede, não que seja do investigado: confira a titularidade antes de usar.</CardDescription></div>
          {checkedSocial && <Badge tone={found.length ? 'gold' : 'neutral'}>{found.length} perfil(is) confirmado(s)</Badge>}</CardHeader>
        <CardContent className="space-y-5">
          {canEdit && (
            <form onSubmit={save} className="flex flex-wrap items-end gap-2">
              <label className="min-w-64 flex-1 text-sm">
                <span className="mb-1 block text-muted-foreground">Nomes de usuário (separe por vírgula)</span>
                <Input value={handles} onChange={(e) => setHandles(e.target.value)} placeholder="@fulano, fulano.silva ou link do perfil" />
              </label>
              <Button loading={busy}><AtSign />Salvar e buscar</Button>
            </form>
          )}
          {!checkedSocial ? <Empty icon={Share2} title="Ainda não pesquisado nas redes" /> : (
            <div className="grid gap-5 lg:grid-cols-2">
              <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Perfis confirmados</div>
                <List items={found} empty={target.usernames ? 'Nenhum perfil confirmado para os nomes de usuário informados.' : 'Informe um nome de usuário para procurar perfis.'} /></div>
              <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Contas com o mesmo nome</div>
                <List items={same} empty="Nenhuma conta com o mesmo nome." /></div>
              <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Publicações que citam o nome</div>
                <List items={posts} empty="Nenhuma publicação pública encontrada." /></div>
              <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Conferir manualmente (exigem login)</div>
                <List items={manual} empty="Informe um nome de usuário para gerar os links." /></div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><div><CardTitle>Buscadores na internet</CardTitle><CardDescription>Nome completo e CPF/CNPJ. Páginas que citam o documento aparecem primeiro. Resultados por nome podem ser de homônimos.</CardDescription></div>
          {checkedWeb && <Badge tone={webAuto.some((r) => /citado/.test(r.title)) ? 'gold' : 'neutral'}>{webAuto.length} página(s)</Badge>}</CardHeader>
        <CardContent>
          {!checkedWeb ? <Empty icon={Search} title="Ainda não pesquisado nos buscadores" /> : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Páginas encontradas</div>
                <List items={webAuto} empty="Busca automática não configurada: informe a chave do Brave ou o endereço do SearXNG em Configurações → Fontes." /></div>
              <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Abrir no Google, Bing, DuckDuckGo e Yandex</div>
                <List items={webLinks} empty="Sem nome ou documento para buscar." /></div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Diário Oficial da União</CardTitle><CardDescription>Atos, nomeações, contratos e licitações.</CardDescription></div><Newspaper className="size-4 text-muted-foreground" /></CardHeader>
        <CardContent><List items={dou} empty="0 (zero) publicações encontradas." /></CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><div><CardTitle>Diários Oficiais dos Estados</CardTitle><CardDescription>Busca do nome e do CPF/CNPJ dentro do site do diário de cada estado (escolha os estados em Configurações → Fontes).</CardDescription></div><Newspaper className="size-4 text-muted-foreground" /></CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Publicações encontradas</div>
            <List items={doe} empty={doeLinks.length ? 'Busca automática não configurada: informe a chave do Brave ou o SearXNG em Configurações → Fontes, ou use as buscas prontas ao lado.' : '0 (zero) publicações encontradas.'} /></div>
          <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Buscas prontas no Google</div>
            <List items={doeLinks} empty="Ainda não pesquisado." /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Diários oficiais municipais</CardTitle><CardDescription>Fonte: Querido Diário.</CardDescription></div><Newspaper className="size-4 text-muted-foreground" /></CardHeader>
        <CardContent><List items={municipal} empty="0 (zero) publicações encontradas." /></CardContent>
      </Card>
    </div>
  );
}
