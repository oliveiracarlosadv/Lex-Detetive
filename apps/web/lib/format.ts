export const fmtDate = (v?: string | Date | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
export const fmtDateTime = (v?: string | Date | null) =>
  v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtMoney = (v?: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

export function timeAgo(v?: string | Date | null) {
  if (!v) return '—';
  const s = Math.round((Date.now() - +new Date(v)) / 1000);
  const f = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (Math.abs(s) < 60) return f.format(-s, 'second');
  if (Math.abs(s) < 3600) return f.format(-Math.round(s / 60), 'minute');
  if (Math.abs(s) < 86400) return f.format(-Math.round(s / 3600), 'hour');
  if (Math.abs(s) < 86400 * 30) return f.format(-Math.round(s / 86400), 'day');
  return fmtDate(v);
}

export const INTERVAL_LABEL: Record<number, string> = { 1: '1 minuto', 5: '5 minutos', 15: '15 minutos', 30: '30 minutos', 60: '1 hora', 360: '6 horas', 1440: '24 horas' };

export function maskInput(kind: 'cpf' | 'cnpj' | 'cnj' | 'cep' | 'phone', v: string) {
  const d = v.replace(/\D/g, '');
  switch (kind) {
    case 'cpf': return d.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    case 'cnpj': return d.slice(0, 14).replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    case 'cep': return d.slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
    case 'phone': return d.slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2');
    case 'cnj': {
      const x = d.slice(0, 20);
      return x.replace(/^(\d{7})(\d)/, '$1-$2').replace(/^(\d{7}-\d{2})(\d)/, '$1.$2').replace(/^(.{13})(\d)/, '$1.$2').replace(/^(.{15})(\d)/, '$1.$2').replace(/^(.{18})(\d)/, '$1.$2');
    }
  }
}

/** Ano do processo pelo número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO). */
export const cnjYear = (n?: string | null) => /^\d{7}-\d{2}\.(\d{4})\./.exec(n || '')?.[1] || '';

/** Anos presentes na lista, do mais recente ao mais antigo, com a quantidade de processos. */
export function yearsOf(list: { number?: string }[]) {
  const count = new Map<string, number>();
  for (const p of list) { const y = cnjYear(p.number); if (y) count.set(y, (count.get(y) || 0) + 1); }
  return [...count.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}
