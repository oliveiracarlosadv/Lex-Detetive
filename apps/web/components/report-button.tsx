'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog } from './ui/misc';
import { Field, Select } from './ui/input';
import { download } from '@/lib/api';

export const REPORT_TYPES: Record<string, string> = {
  sintetico: 'Relatório Sintético', analitico: 'Relatório Analítico', processual: 'Relatório Processual',
  due_diligence: 'Relatório de Due Diligence', compliance: 'Relatório de Compliance', investigacao: 'Relatório de Investigação',
};
export const FORMATS = ['pdf', 'docx', 'odt', 'xlsx', 'csv', 'html', 'txt', 'json'];

export function ReportButton({ targetId, variant = 'outline' }: { targetId: string; variant?: 'outline' | 'default' }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('analitico');
  const [format, setFormat] = useState('pdf');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { const name = await download(`/reports/targets/${targetId}?type=${type}&format=${format}`); toast.success(`${name} baixado.`); setOpen(false); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}><FileText />Relatório</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Gerar relatório" description="Com identidade visual Lex Tecnologias e código de integridade SHA-256."
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={go} loading={busy}><Download />Baixar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo"><Select value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(REPORT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Formato"><Select value={format} onChange={(e) => setFormat(e.target.value)}>{FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}</Select></Field>
        </div>
      </Dialog>
    </>
  );
}
