import { CheckCircle2, MinusCircle, AlertTriangle } from 'lucide-react';
import { Badge } from './ui/badge';

/** Etiqueta do tribunal, colorida pelo ramo da Justiça. */
export function CourtTag({ court }: { court?: string | null }) {
  const c = (court || '').toUpperCase();
  if (!c || c === '—') return <Badge>—</Badge>;
  const tone = /^TJ/.test(c) ? 'green' : /^TRF/.test(c) ? 'blue' : /^TRT/.test(c) ? 'gold' : 'neutral';
  const title = /^TJM/.test(c) ? 'Justiça Militar Estadual' : /^TJ/.test(c) ? 'Justiça Estadual' : /^TRF/.test(c) ? 'Justiça Federal'
    : /^TRT/.test(c) ? 'Justiça do Trabalho' : /^TRE|^TSE/.test(c) ? 'Justiça Eleitoral' : 'Tribunal Superior';
  return <Badge tone={tone as any} title={title} className="font-semibold tracking-wide">{c}</Badge>;
}

/** Resultado da conferência do CPF/CNPJ do monitorado nas publicações. */
export function DocTag({ status, found }: { status?: string | null; found?: string | null }) {
  if (status === 'confirmado')
    return <Badge tone="green" title={found ? `Documento na publicação: ${found}` : undefined}><CheckCircle2 className="size-3" />CPF confere</Badge>;
  if (status === 'divergente')
    return <Badge tone="red" title={found ? `Documento na publicação: ${found}` : undefined}><AlertTriangle className="size-3" />CPF diferente{found ? ` (${found})` : ''}</Badge>;
  return <Badge title="A publicação não traz o CPF/CNPJ da parte"><MinusCircle className="size-3" />CPF não informado</Badge>;
}
