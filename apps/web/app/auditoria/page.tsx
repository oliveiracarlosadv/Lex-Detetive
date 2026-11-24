'use client';
import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Empty, PageHeader, Skeleton, Table, Td, Th } from '@/components/ui/misc';
import { fmtDateTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';

export default function AuditPage() {
  const { data, loading, error } = useApi<any[]>('/audit?limit=1000');
  const [q, setQ] = useState('');
  const rows = (data || []).filter((r) => !q || `${r.action} ${r.user?.name || ''} ${r.details || ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Auditoria" description="Registro de acessos, pesquisas, visualização de dados sensíveis, relatórios e alterações (LGPD)." />
      <Card>
        <div className="border-b border-border p-3"><Input placeholder="Filtrar" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {loading ? <div className="p-4"><Skeleton className="h-60" /></div> : error ? <Empty title={error} /> : !rows.length ? <Empty icon={ScrollText} title="Sem registros" /> : (
          <Table>
            <thead><tr><Th>Data</Th><Th>Usuário</Th><Th>Ação</Th><Th>Objeto</Th><Th>Detalhes</Th><Th>IP</Th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}><Td className="whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</Td><Td className="text-xs">{r.user?.name || '—'}</Td><Td className="font-mono text-xs">{r.action}</Td>
                <Td className="text-xs">{r.entity ? `${r.entity}` : '—'}</Td><Td className="max-w-md truncate text-xs text-muted-foreground" title={r.details || ''}>{r.details || ''}</Td><Td className="text-xs">{r.ip || ''}</Td></tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
