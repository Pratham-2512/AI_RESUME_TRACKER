/**
 * Lightweight, dependency-free charts (pure SVG/divs). No hooks — render from
 * server or client. Inherit theme colors via currentColor / design tokens.
 */
import { Empty } from "@/components/shared/ui";

export type Point = { label: string; value: number };

/** Vertical bar chart. */
export function BarChart({ data, suffix = "", emptyLabel = "No data yet." }: { data: Point[]; suffix?: string; emptyLabel?: string }) {
  if (!data.length || data.every((d) => d.value === 0)) return <Empty>{emptyLabel}</Empty>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2" style={{ height: 140 }}>
      {data.map((d, i) => (
        <div key={i} className="group flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{d.value || ""}</span>
          <div className="w-full rounded-md bg-primary/70 transition-all duration-300 group-hover:bg-primary"
            style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }} title={`${d.label}: ${d.value}${suffix}`} />
          <span className="w-full truncate text-center text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Smooth line/area chart for score or growth trends. */
export function LineChart({ data, min = 0, max, suffix = "", emptyLabel = "No data yet." }: { data: Point[]; min?: number; max?: number; suffix?: string; emptyLabel?: string }) {
  if (data.length < 2) return <Empty>{emptyLabel}</Empty>;
  const W = 100, H = 40;
  const hi = max ?? Math.max(...data.map((d) => d.value), 1);
  const lo = Math.min(min, ...data.map((d) => d.value));
  const span = hi - lo || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.value - lo) / span) * H;
    return [x, y] as const;
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;
  const last = data[data.length - 1];
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{data[0].label} → {last.label}</span>
        <span className="text-sm font-semibold tabular-nums">{last.value}{suffix}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-24 w-full">
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lc-fill)" />
        <path d={path} fill="none" className="stroke-primary" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={1.4} className="fill-primary" vectorEffect="non-scaling-stroke" />)}
      </svg>
    </div>
  );
}

/** Horizontal funnel — each stage as a proportional bar. */
export function FunnelChart({ data }: { data: { stage: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.some((d) => d.count > 0)) return <Empty>No applications tracked yet.</Empty>;
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.stage}>
          <div className="flex justify-between text-sm"><span className="font-medium">{d.stage}</span><span className="tabular-nums text-xs text-muted-foreground">{d.count}</span></div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
              style={{ width: `${Math.max(4, (d.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
