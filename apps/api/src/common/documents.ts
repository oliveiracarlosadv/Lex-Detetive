/** Utilitários para CPF, CNPJ e número de processo CNJ. */

export const onlyDigits = (v?: string | null) => (v || '').replace(/\D/g, '');

export function isValidCpf(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export function isValidCnpj(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(c[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

export const formatCpf = (v: string) => onlyDigits(v).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
export const formatCnpj = (v: string) =>
  onlyDigits(v).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

/** Mascaramento LGPD: ***.456.789-** */
export function maskCpf(v: string): string {
  const c = onlyDigits(v);
  if (c.length !== 11) return '***';
  return `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**`;
}

/** CNPJ é dado público de empresa, mas mascaramos parcialmente nas listagens. */
export function maskCnpj(v: string): string {
  const c = onlyDigits(v);
  if (c.length !== 14) return '***';
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.***/****-${c.slice(12)}`;
}

export function maskDocument(v: string): string {
  return onlyDigits(v).length === 14 ? maskCnpj(v) : maskCpf(v);
}

/** Número CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (Resolução CNJ 65/2008). */
export function formatCnj(v: string): string {
  const d = onlyDigits(v);
  if (d.length !== 20) return v;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

export function isValidCnj(v: string): boolean {
  const d = onlyDigits(v);
  if (d.length !== 20) return false;
  const n = d.slice(0, 7), dv = d.slice(7, 9), rest = d.slice(9);
  const big = BigInt(n + rest + '00');
  return Number(98n - (big % 97n)) === Number(dv);
}

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SE','SP','TO'];

/** Identifica o tribunal a partir dos segmentos J.TR do número CNJ. */
export function courtFromCnj(v: string): string | null {
  const d = onlyDigits(v);
  if (d.length !== 20) return null;
  const j = d[13];
  const tr = Number(d.slice(14, 16));
  switch (j) {
    case '1': return 'STF';
    case '3': return 'STJ';
    case '4': return tr >= 1 && tr <= 6 ? `TRF${tr}` : null;
    case '5': return tr === 0 ? 'TST' : tr <= 24 ? `TRT${tr}` : null;
    case '6': return tr === 0 ? 'TSE' : UFS[tr - 1] ? `TRE-${UFS[tr - 1]}` : null;
    case '7': return 'STM';
    case '8': {
      const uf = UFS[tr - 1];
      return uf ? (uf === 'DF' ? 'TJDFT' : `TJ${uf}`) : null;
    }
    case '9': return ({ 13: 'TJMMG', 21: 'TJMRS', 26: 'TJMSP' } as Record<number, string>)[tr] || null;
    default: return null;
  }
}

/** Monta um número CNJ com dígito verificador válido (módulo 97). */
export function buildCnj(seq: number, year: number, j: string, tr: string, origin: string): string {
  const n = String(seq).padStart(7, '0');
  const dv = 98 - Number(BigInt(`${n}${year}${j}${tr}${origin}00`) % 97n);
  return `${n}-${String(dv).padStart(2, '0')}.${year}.${j}.${tr}.${origin}`;
}
