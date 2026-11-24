'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Field, Input, Select, Textarea } from './ui/input';
import { Dialog } from './ui/misc';
import { api } from '@/lib/api';
import { maskInput } from '@/lib/format';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SE SP TO'.split(' ');
const empty = {
  kind: 'PF', name: '', tradeName: '', document: '', rg: '', stateReg: '', birthDate: '', maritalStatus: '', profession: '', nationality: 'brasileira',
  email: '', email2: '', phone: '', whatsapp: '', website: '', usernames: '', zip: '', street: '', number: '', complement: '', district: '', city: '', state: '',
  contactPerson: '', responsible: '', notes: '', status: 'ativo',
};

export function ClientFormDialog({ open, onClose, client, initial, title, onSaved }: { open: boolean; onClose: () => void; client?: any; initial?: Partial<typeof empty>; title?: string; onSaved: (c: any) => void }) {
  const editing = !!client;
  const [f, setF] = useState<typeof empty>(() => client ? { ...empty, ...Object.fromEntries(Object.entries(client).map(([k, v]) => [k, v ?? ''])), birthDate: client.birthDate ? client.birthDate.slice(0, 10) : '', document: '' } as any : { ...empty, ...initial });
  const [saving, setSaving] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const set = (k: keyof typeof empty, mask?: Parameters<typeof maskInput>[0]) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: mask ? maskInput(mask, e.target.value) : e.target.value });
  const pf = f.kind === 'PF';

  const lookupCep = async () => {
    if (f.zip.replace(/\D/g, '').length !== 8) return;
    setCepBusy(true);
    try { const r = await api(`/cep/${f.zip}`); setF((x) => ({ ...x, street: r.street || x.street, district: r.district || x.district, city: r.city || x.city, state: r.state || x.state })); }
    catch { toast.error('CEP não encontrado (ou sem internet).'); } finally { setCepBusy(false); }
  };

  const [cnpjBusy, setCnpjBusy] = useState(false);
  /** CNPJ completo: preenche os campos vazios com os dados públicos (BrasilAPI + CNPJá). */
  const lookupCnpj = async () => {
    if (f.kind !== 'PJ' || f.document.replace(/\D/g, '').length !== 14) return;
    setCnpjBusy(true);
    try {
      const r = await api(`/cnpj/${f.document.replace(/\D/g, '')}`);
      const g = r.registry || {}; const a = r.address || {};
      const keep = (cur: string, v?: string | null) => cur || v || '';
      setF((x) => ({
        ...x, name: keep(x.name, g.razaoSocial), tradeName: keep(x.tradeName, g.nomeFantasia),
        birthDate: keep(x.birthDate, g.abertura?.slice(0, 10)), email: keep(x.email, r.emails?.[0]), email2: keep(x.email2, r.emails?.[1]),
        phone: keep(x.phone, r.phones?.[0]), zip: keep(x.zip, a.zip ? String(a.zip).replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2') : ''),
        street: keep(x.street, a.street), number: keep(x.number, a.number), complement: keep(x.complement, a.complement),
        district: keep(x.district, a.district), city: keep(x.city, a.city), state: keep(x.state, a.state),
        contactPerson: keep(x.contactPerson, (g.socios || []).find((s: any) => /administrador/i.test(s.qualificacao || ''))?.nome),
      }));
      toast.success(`Dados do CNPJ preenchidos (${r.sources.join(' e ')}). Confira antes de salvar.`);
    } catch (e: any) { toast.error(e.message); } finally { setCnpjBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = { ...f };
      if (editing && !f.document) delete body.document; // documento só muda se preenchido
      if (editing) delete body.kind;
      const r = editing ? await api(`/clients/${client.id}`, { method: 'PATCH', body }) : await api('/clients', { method: 'POST', body });
      toast.success(editing ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      onSaved(r);
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const H = ({ children }: { children: React.ReactNode }) => <div className="col-span-full mt-2 border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>;

  return (
    <Dialog open={open} onClose={onClose} wide title={title || (editing ? 'Editar cliente' : 'Novo cliente')} description="Dados gerais, contato e endereço."
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button form="client-form" loading={saving}>Salvar</Button></>}>
      <form id="client-form" onSubmit={submit} className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-6">
        {!editing && (
          <div className="col-span-full grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {['PF', 'PJ'].map((k) => <button type="button" key={k} onClick={() => setF({ ...f, kind: k })} className={`rounded-md py-1.5 text-sm cursor-pointer ${f.kind === k ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{k === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}</button>)}
          </div>
        )}
        <H>Dados gerais</H>
        <Field className="sm:col-span-4" label={pf ? 'Nome completo *' : 'Razão social *'}><Input required value={f.name} onChange={set('name')} /></Field>
        <Field className="sm:col-span-2" label="Situação"><Select value={f.status} onChange={set('status')}><option value="ativo">Ativo</option><option value="prospecto">Prospecto</option><option value="inativo">Inativo</option></Select></Field>
        {!pf && <Field className="sm:col-span-3" label="Nome fantasia"><Input value={f.tradeName} onChange={set('tradeName')} /></Field>}
        <Field className="sm:col-span-3" label={pf ? 'CPF' : 'CNPJ'} hint={editing ? 'Deixe em branco para manter o atual.' : pf ? undefined : 'Ao completar o CNPJ, os dados públicos da empresa são preenchidos.'}>
          <div className="flex gap-2"><Input value={f.document} inputMode="numeric" onChange={set('document', pf ? 'cpf' : 'cnpj')} onBlur={lookupCnpj} placeholder={editing ? client.document || '' : ''} />
            {!pf && <Button type="button" variant="outline" loading={cnpjBusy} disabled={f.document.replace(/\D/g, '').length !== 14} onClick={lookupCnpj}>Buscar dados</Button>}</div></Field>
        {pf ? (
          <>
            <Field className="sm:col-span-3" label="RG"><Input value={f.rg} onChange={set('rg')} /></Field>
            <Field className="sm:col-span-2" label="Data de nascimento"><Input type="date" value={f.birthDate} onChange={set('birthDate')} /></Field>
            <Field className="sm:col-span-2" label="Estado civil"><Select value={f.maritalStatus} onChange={set('maritalStatus')}><option value="">—</option>{['solteiro(a)', 'casado(a)', 'união estável', 'divorciado(a)', 'separado(a)', 'viúvo(a)'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field className="sm:col-span-2" label="Nacionalidade"><Input value={f.nationality} onChange={set('nationality')} /></Field>
            <Field className="sm:col-span-3" label="Profissão"><Input value={f.profession} onChange={set('profession')} /></Field>
          </>
        ) : (
          <>
            <Field className="sm:col-span-3" label="Inscrição estadual"><Input value={f.stateReg} onChange={set('stateReg')} /></Field>
            <Field className="sm:col-span-3" label="Data de abertura"><Input type="date" value={f.birthDate} onChange={set('birthDate')} /></Field>
            <Field className="sm:col-span-3" label="Representante / contato"><Input value={f.contactPerson} onChange={set('contactPerson')} /></Field>
          </>
        )}
        <Field className="sm:col-span-3" label="Advogado responsável"><Input value={f.responsible} onChange={set('responsible')} /></Field>

        <H>Contato e endereço eletrônico</H>
        <Field className="sm:col-span-3" label="E-mail principal"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field className="sm:col-span-3" label="E-mail secundário"><Input type="email" value={f.email2} onChange={set('email2')} /></Field>
        <Field className="sm:col-span-2" label="Telefone"><Input value={f.phone} inputMode="tel" onChange={set('phone', 'phone')} /></Field>
        <Field className="sm:col-span-2" label="WhatsApp"><Input value={f.whatsapp} inputMode="tel" onChange={set('whatsapp', 'phone')} /></Field>
        <Field className="sm:col-span-2" label="Site"><Input value={f.website} onChange={set('website')} placeholder="https://" /></Field>
        <Field className="sm:col-span-6" label="Redes sociais" hint="Nomes de usuário ou links dos perfis (Instagram, Facebook, LinkedIn, X, TikTok…), separados por vírgula. São usados na busca em redes sociais do monitoramento.">
          <Input value={f.usernames} onChange={set('usernames')} placeholder="@usuario, instagram.com/usuario, linkedin.com/in/usuario" /></Field>

        <H>Endereço</H>
        <Field className="sm:col-span-2" label="CEP" hint={cepBusy ? 'Buscando…' : 'Preenche o endereço automaticamente.'}><Input value={f.zip} inputMode="numeric" onChange={set('zip', 'cep')} onBlur={lookupCep} /></Field>
        <Field className="sm:col-span-4" label="Logradouro"><Input value={f.street} onChange={set('street')} /></Field>
        <Field className="sm:col-span-1" label="Número"><Input value={f.number} onChange={set('number')} /></Field>
        <Field className="sm:col-span-2" label="Complemento"><Input value={f.complement} onChange={set('complement')} /></Field>
        <Field className="sm:col-span-3" label="Bairro"><Input value={f.district} onChange={set('district')} /></Field>
        <Field className="sm:col-span-4" label="Cidade"><Input value={f.city} onChange={set('city')} /></Field>
        <Field className="sm:col-span-2" label="UF"><Select value={f.state} onChange={set('state')}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</Select></Field>

        <H>Observações</H>
        <Field className="col-span-full" label="Anotações internas"><Textarea value={f.notes} onChange={set('notes')} rows={3} /></Field>
      </form>
    </Dialog>
  );
}
