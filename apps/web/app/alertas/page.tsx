'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bell, CheckCheck, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Empty, PageHeader, Skeleton } from '@/components/ui/misc';
import { AlertCard, ALERT_LABEL } from '@/components/alert-card';
import { ClientFormDialog } from '@/components/client-form';
import { AlertPartiesPanel, AlertParty, looksLikeCompany, roleOf } from '@/components/alert-parties';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

export default function AlertsPage() {
  const [unread, setUnread] = useState(true);
  const [type, setType] = useState('');
  const { data, loading, reload } = useApi<any[]>(`/alerts?unread=${unread}`, [unread]);
  const { data: parties, loading: loadingParties, reload: reloadParties } = useApi<AlertParty[]>(`/alerts/parties?unread=${unread}`, [unread]);
  const [party, setParty] = useState<string | null>(null);
  const partyAlerts = party ? new Set((parties || []).find((p) => p.name === party)?.alertIds || []) : null;
  const list = (data || []).filter((a) => (!type || a.type === type) && (!partyAlerts || partyAlerts.has(a.id)));
  const read = async (id: string) => { await api(`/alerts/${id}/read`, { method: 'POST' }); reload(true); reloadParties(true); };
  const router = useRouter();
  // Cadastro de cliente: em branco (botão do topo) ou a partir de um alerta (já preenchido e vinculado).
  const [register, setRegister] = useState<{ alert?: any; initial?: any; party?: AlertParty } | null>(null);
  const registerFrom = async (a: any) => {
    let initial: any = {};
    if (a.target) {
      try { const t = await api(`/targets/${a.target.id}`); initial = { kind: t.kind, name: t.name || '', tradeName: t.tradeName || '' }; }
      catch { initial = { name: a.target.name }; }
    }
    setRegister({ alert: a, initial });
  };
  const saved = async (c: any) => {
    const a = register?.alert;
    const p = register?.party;
    setRegister(null);
    if (p) {
      try {
        const r = p.processIds.length ? await api(`/clients/${c.id}/link-many`, { method: 'POST', body: { processIds: p.processIds, role: roleOf(p) } }) : { linked: 0 };
        toast.success(`Cliente ${c.name} cadastrado${r.linked ? ` e ${r.linked} processo(s) vinculado(s)` : ''}.`);
      } catch (e: any) { toast.error(e.message); }
      reloadParties(true);
      return;
    }
    try {
      if (a?.target) await api(`/clients/${c.id}/link-target`, { method: 'POST', body: { targetId: a.target.id } });
      else if (a?.processId) await api(`/clients/${c.id}/processes`, { method: 'POST', body: { processId: a.processId } });
      if (a) toast.success('Monitoramento e processos vinculados ao novo cliente.');
    } catch (e: any) { toast.error(e.message); }
    router.push(`/clientes/detalhe/?id=${c.id}`);
  };
  const readAll = async () => { const r = await api('/alerts/read-all', { method: 'POST' }); toast.success(`${r.updated} alerta(s) marcados como lidos.`); reload(true); reloadParties(true); };

  return (
    <>
      <PageHeader title="Alertas" description="Novos processos, movimentações, intimações, alterações cadastrais e sanções."
        actions={<div className="flex flex-wrap gap-2"><Button onClick={() => setRegister({})}><UserPlus />Cadastrar cliente</Button><Button variant="outline" onClick={readAll}><CheckCheck />Marcar todos como lidos</Button></div>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select className="w-44" value={String(unread)} onChange={(e) => setUnread(e.target.value === 'true')}><option value="true">Não lidos</option><option value="false">Todos</option></Select>
        <Select className="w-52" value={type} onChange={(e) => setType(e.target.value)}><option value="">Todos os tipos</option>{Object.entries(ALERT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {loading && !data ? <Skeleton className="h-64" /> : !list.length ? <Card><Empty icon={Bell} title="Nenhum alerta">{party ? `Nenhum alerta com ${party} neste filtro.` : 'Os alertas aparecem aqui quando o monitoramento detecta novidades.'}</Empty></Card> : (
            <div className="space-y-3">{list.map((a) => <AlertCard key={a.id} alert={a} onRead={read} onRegisterClient={registerFrom} />)}</div>
          )}
        </div>
        <aside className="order-first lg:order-none">
          <AlertPartiesPanel parties={parties} loading={loadingParties} selected={party} onSelect={setParty} onLinked={() => reloadParties(true)}
            onRegister={(p) => setRegister({ party: p, initial: { kind: looksLikeCompany(p.name) ? 'PJ' : 'PF', name: p.name } })} />
        </aside>
      </div>
      {register && (
        <ClientFormDialog open onClose={() => setRegister(null)} initial={register.initial} onSaved={saved}
          title={register.party ? `Cadastrar cliente — ${register.party.name}` : register.alert ? `Cadastrar cliente — ${register.alert.target?.name || 'a partir do alerta'}` : 'Novo cliente'} />
      )}
    </>
  );
}
