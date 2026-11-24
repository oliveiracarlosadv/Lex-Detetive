import { Badge } from './ui/badge';

/** Exibe o resultado estruturado do Lex AI (ou da análise por regras). */
export function AnalysisView({ a }: { a: any }) {
  const r = a.result || {};
  const List = ({ title, items }: { title: string; items?: any[] }) => items?.length ? (
    <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="list-disc space-y-0.5 pl-5 text-sm">{items.map((x, i) => <li key={i}>{typeof x === 'string' ? x : x.nome ? `${x.nome}${x.papel ? ` (${x.papel})` : ''}` : x.descricao ? `${x.descricao}${x.valor ? `: ${x.valor}` : ''}${x.data ? ` — ${x.data}` : ''}` : x.evento ? `${x.data}: ${x.evento}` : JSON.stringify(x)}</li>)}</ul></div>
  ) : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge tone={a.provider === 'regras' ? 'neutral' : 'gold'}>{a.provider === 'regras' ? 'Análise por regras' : `${a.provider} · ${a.model}`}</Badge>
        {new Date(a.createdAt).toLocaleString('pt-BR')}
      </div>
      <p className="text-sm leading-relaxed">{r.resumo}</p>
      {r.riscos?.length > 0 && (
        <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Riscos</div>
          <ul className="space-y-1">{r.riscos.map((x: any, i: number) => <li key={i} className="flex gap-2 text-sm"><Badge tone={x.nivel === 'alto' ? 'red' : x.nivel === 'medio' ? 'gold' : 'neutral'}>{x.nivel}</Badge>{x.descricao}</li>)}</ul></div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <List title="Oportunidades" items={r.oportunidades} />
        <List title="Prazos" items={r.prazos} />
        <List title="Partes" items={r.partes} />
        <List title="Advogados" items={r.advogados} />
        <List title="Juízes" items={r.juizes} />
        <List title="Valores" items={r.valores} />
        <List title="Datas" items={r.datas} />
        <List title="Eventos processuais" items={r.eventos} />
      </div>
      {r.prescricao && <div><div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Prescrição</div><p className="text-sm">{r.prescricao}</p></div>}
      {r.parecer && <div className="rounded-lg border border-primary/25 bg-primary/5 p-3"><div className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">Parecer inicial</div><p className="text-sm leading-relaxed">{r.parecer}</p></div>}
      {r.observacao && <p className="text-xs text-muted-foreground">{r.observacao}</p>}
    </div>
  );
}
