'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Radar } from 'lucide-react';
import { Button } from './ui/button';
import { Field, Input, Select, Textarea } from './ui/input';
import { Dialog } from './ui/misc';
import { api } from '@/lib/api';
import { INTERVAL_LABEL, maskInput } from '@/lib/format';

export function NewTargetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<'PF' | 'PJ'>('PF');
  const [f, setF] = useState({ name: '', document: '', tradeName: '', motherName: '', fatherName: '', numbers: '', purpose: '', interval: 1440, oab: '', usernames: '' });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api('/targets', { method: 'POST', body: {
        kind, name: f.name, document: f.document, tradeName: f.tradeName, motherName: f.motherName, fatherName: f.fatherName,
        processNumbers: f.numbers.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean), purpose: f.purpose, oab: kind === 'PF' && f.oab ? f.oab : undefined, usernames: f.usernames || undefined, monitored: true, intervalMinutes: f.interval,
      } });
      toast.success(`Cadastrado. ${r.result.newProcesses} processo(s) na pesquisa inicial.`);
      router.push(`/alvo/?id=${r.id}`);
    } catch (err: any) {
      if (err.body?.id) router.push(`/alvo/?id=${err.body.id}`);
      toast.error(err.message);
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Monitorar pessoa ou empresa" description="A pesquisa inicial roda logo após o cadastro."
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button form="new-target" loading={saving}><Radar />Monitorar</Button></>}>
      <form id="new-target" onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(['PF', 'PJ'] as const).map((k) => (
            <button type="button" key={k} onClick={() => setKind(k)} className={`rounded-md py-1.5 text-sm cursor-pointer ${kind === k ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{k === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}</button>
          ))}
        </div>
        <Field label={kind === 'PF' ? 'Nome completo' : 'Razão social'}><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={kind === 'PF' ? 'CPF' : 'CNPJ'}><Input value={f.document} inputMode="numeric" onChange={(e) => setF({ ...f, document: maskInput(kind === 'PF' ? 'cpf' : 'cnpj', e.target.value) })} /></Field>
          <Field label="Atualizar a cada"><Select value={f.interval} onChange={(e) => setF({ ...f, interval: Number(e.target.value) })}>{Object.entries(INTERVAL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        </div>
        {kind === 'PF' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome da mãe"><Input value={f.motherName} onChange={(e) => setF({ ...f, motherName: e.target.value })} /></Field>
            <Field label="Nome do pai"><Input value={f.fatherName} onChange={(e) => setF({ ...f, fatherName: e.target.value })} /></Field>
            <Field label="OAB (se advogado)" hint="Monitora intimações no DJEN"><Input value={f.oab} placeholder="12345/UF" onChange={(e) => setF({ ...f, oab: e.target.value })} /></Field>
          </div>
        ) : <Field label="Nome fantasia"><Input value={f.tradeName} onChange={(e) => setF({ ...f, tradeName: e.target.value })} /></Field>}
        <Field label="Nomes de usuário (redes sociais)" hint="Opcional. Separe por vírgula."><Input value={f.usernames} placeholder="@usuario" onChange={(e) => setF({ ...f, usernames: e.target.value })} /></Field>
        <Field label="Processos conhecidos (CNJ)" hint="Um por linha. Movimentações e intimações destes processos serão monitoradas."><Textarea rows={2} value={f.numbers} onChange={(e) => setF({ ...f, numbers: e.target.value })} /></Field>
        <Field label="Finalidade (LGPD)" hint="Registre a base legal/finalidade do tratamento."><Input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="Ex.: acompanhamento de processo de cliente" /></Field>
      </form>
    </Dialog>
  );
}

