'use client';
import { toast } from 'sonner';
import { ExternalLink, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';

const BNMP_URL = 'https://portalbnmp.cnj.jus.br/#/pesquisa-peca';

/** Abre o BNMP (CNJ). O portal exige captcha, então copiamos nome/CPF para colar. */
export function BnmpButton({ name, cpf, size = 'default' }: { name?: string; cpf?: string; size?: 'default' | 'sm' }) {
  const open = async () => {
    const text = cpf || name || '';
    if (text) { try { await navigator.clipboard.writeText(text); toast.info(`"${text}" copiado. Cole no campo de pesquisa do BNMP.`); } catch { /* sem permissão */ } }
    window.open(BNMP_URL, '_blank', 'noopener,noreferrer');
  };
  return <Button variant="outline" size={size} onClick={open} title="Banco Nacional de Mandados de Prisão (CNJ)"><ShieldAlert />Consultar BNMP<ExternalLink className="opacity-60" /></Button>;
}

