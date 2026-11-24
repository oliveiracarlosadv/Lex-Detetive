'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/misc';
import { FORMATS, REPORT_TYPES } from '@/components/report-button';
import { download } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';

const DESC: Record<string, string> = {
  sintetico: 'Identificação, resumo e lista de processos.',
  analitico: 'Cadastro, processos com últimas movimentações, sanções e análise Lex AI.',
  processual: 'Todos os processos com movimentações completas.',
  due_diligence: 'Cadastro, quadro societário, processos, sanções e diários oficiais.',
  compliance: 'Situação cadastral, sanções CEIS/CNEP e riscos.',
  investigacao: 'Tudo, mais linha do tempo consolidada e histórico de alterações.',
};

export default function ReportsPage() {
  const { data: targets } = useApi<any[]>('/targets');
  const [target, setTarget] = useState('');
  const [type, setType] = useState('analitico');
  const [format, setFormat] = useState('pdf');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!target) return toast.error('Escolha uma pessoa ou empresa.');
    setBusy(true);
    try { toast.success(`${await download(`/reports/targets/${target}?type=${type}&format=${format}`)} baixado.`); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Relatórios" description="Relatórios com identidade visual Lex Tecnologias e código de integridade SHA-256." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(REPORT_TYPES).map(([k, v]) => (
            <button key={k} onClick={() => setType(k)} className={cn('rounded-xl border bg-card p-4 text-left transition-colors cursor-pointer', type === k ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-input')}>
              <FileText className={cn('mb-2 size-5', type === k ? 'text-primary' : 'text-muted-foreground')} />
              <div className="text-sm font-medium">{v}</div><div className="mt-1 text-xs text-muted-foreground">{DESC[k]}</div>
            </button>
          ))}
        </div>
        <Card className="h-fit">
          <CardHeader><div><CardTitle>Gerar</CardTitle><CardDescription>{REPORT_TYPES[type]}</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Pessoa ou empresa"><Select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Selecione…</option>{targets?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            <Field label="Formato"><Select value={format} onChange={(e) => setFormat(e.target.value)}>{FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}</Select></Field>
            <Button className="w-full" onClick={go} loading={busy}><Download />Baixar relatório</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
