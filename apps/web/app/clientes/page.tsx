'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Contact, DatabaseZap, Mail, Phone, Plus, Search, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { Empty, PageHeader, Skeleton, Table, Td, Th } from '@/components/ui/misc';
import { ClientFormDialog } from '@/components/client-form';
import { useApi } from '@/lib/use-api';

export default function ClientsPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const { data, loading } = useApi<any[]>(`/clients?q=${encodeURIComponent(q)}&status=${status}`, [q, status]);
  return (
    <>
      <PageHeader title="Clientes" description="Cadastro de clientes do escritório e seus processos." actions={<Button onClick={() => setOpen(true)}><Plus />Novo cliente</Button>} />
      <Card>
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome, e-mail, cidade ou CPF/CNPJ" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todas as situações</option><option value="ativo">Ativos</option><option value="prospecto">Prospectos</option><option value="inativo">Inativos</option></Select>
        </div>
        {loading && !data ? <div className="p-4"><Skeleton className="h-40" /></div> : !data?.length ? (
          <Empty icon={Contact} title="Nenhum cliente cadastrado"><Button className="mt-3" onClick={() => setOpen(true)}><Plus />Cadastrar cliente</Button></Empty>
        ) : (
          <Table>
            <thead><tr><Th>Cliente</Th><Th>Documento</Th><Th>Contato</Th><Th>Cidade</Th><Th>Processos</Th><Th>Situação</Th><Th /></tr></thead>
            <tbody>{data.map((c) => (
              <tr key={c.id} className="hover:bg-muted/40">
                <Td><Link href={`/clientes/detalhe/?id=${c.id}`} className="flex items-center gap-2 font-medium hover:underline">{c.kind === 'PF' ? <User className="size-4 text-muted-foreground" /> : <Building2 className="size-4 text-muted-foreground" />}{c.name}</Link>{c.tradeName && <div className="ml-6 text-xs text-muted-foreground">{c.tradeName}</div>}</Td>
                <Td className="font-mono text-xs">{c.document || '—'}</Td>
                <Td className="text-xs">{c.email && <div className="flex items-center gap-1"><Mail className="size-3" />{c.email}</div>}{c.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="size-3" />{c.phone}</div>}</Td>
                <Td className="text-sm">{c.city ? `${c.city}/${c.state || ''}` : '—'}</Td>
                <Td className="tabular-nums">{c.processCount}</Td>
                <Td><Badge tone={c.status === 'ativo' ? 'green' : c.status === 'prospecto' ? 'blue' : 'neutral'}>{c.status}</Badge></Td>
                <Td className="text-right"><Link href={`/pesquisa/?cliente=${c.id}&consultar=1`} title="Consulta todos os processos do cliente em todos os diários e bases públicas"><Button size="sm" variant="outline"><DatabaseZap />Consultar bases</Button></Link></Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
      {open && <ClientFormDialog open onClose={() => setOpen(false)} onSaved={(c) => router.push(`/clientes/detalhe/?id=${c.id}`)} />}
    </>
  );
}
