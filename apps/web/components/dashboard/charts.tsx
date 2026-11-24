'use client';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** SVG não aceita var() em atributos: lemos os tokens do tema e reagimos à troca claro/escuro. */
function useThemeColors() {
  const read = () => {
    if (typeof window === 'undefined') return { chart: '#2B5AA8', grid: '#E6EAF0', muted: '#5B6573', fg: '#0E1726', hover: '#EEF1F5' };
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    return { chart: v('--chart'), grid: v('--chart-grid'), muted: v('--muted-foreground'), fg: v('--foreground'), hover: v('--muted') };
  };
  const [c, setC] = useState(read);
  useEffect(() => {
    setC(read());
    const obs = new MutationObserver(() => setC(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return c;
}

function Tip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-2 font-medium">
        <span className="inline-block h-0.5 w-3 rounded" style={{ background: 'var(--chart)' }} />
        {payload[0].value} {unit}
      </div>
    </div>
  );
}

/** Movimentações por dia (30 dias). Série única: o título nomeia, sem legenda. */
export function MovementsChart({ data }: { data: { date: string; count: number }[] }) {
  const c = useThemeColors();
  const tick = { fontSize: 11, fill: c.muted };
  const rows = data.map((d) => ({ ...d, label: new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }));
  return (
    <>
      <div className="h-56" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={4} />
            <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
            <Tooltip isAnimationActive={false} cursor={{ fill: c.hover }} content={<Tip unit="movimentação(ões)" />} />
            <Bar isAnimationActive={false} dataKey="count" fill={c.chart} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only"><caption>Movimentações por dia</caption><tbody>{rows.map((r) => <tr key={r.date}><td>{r.label}</td><td>{r.count}</td></tr>)}</tbody></table>
    </>
  );
}

/** Processos por tribunal: barras horizontais com rótulo de valor direto. */
export function CourtsChart({ data }: { data: { court: string; count: number }[] }) {
  const c = useThemeColors();
  const tick = { fontSize: 11, fill: c.muted };
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="court" tick={tick} tickLine={false} axisLine={false} width={56} />
          <Tooltip isAnimationActive={false} cursor={{ fill: c.hover }} content={<Tip unit="processo(s)" />} />
          <Bar isAnimationActive={false} dataKey="count" fill={c.chart} radius={[0, 4, 4, 0]} maxBarSize={16}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: c.fg }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
