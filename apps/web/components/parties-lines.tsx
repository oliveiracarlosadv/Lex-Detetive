import { splitParties } from '@/lib/parties';

/** Autor em uma linha, réu na outra. */
export function PartiesLines({ parties }: { parties?: { name: string; role?: string }[] | null }) {
  const { autor, reu } = splitParties(parties);
  return (
    <div className="mt-0.5 space-y-0.5 text-xs">
      <div><span className="font-medium text-foreground">Autor:</span> <span className="text-muted-foreground">{autor}</span></div>
      <div><span className="font-medium text-foreground">Réu:</span> <span className="text-muted-foreground">{reu}</span></div>
    </div>
  );
}
