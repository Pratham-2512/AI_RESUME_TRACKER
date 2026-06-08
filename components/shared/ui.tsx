/**
 * Reusable presentational primitives shared across dashboards.
 * Pure (no hooks) — safe to render from both server and client components.
 * Uses the existing design tokens (card / border / muted / primary / destructive)
 * so everything is automatically mobile-responsive and dark-mode compatible.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Maps a 0-100 score to a semantic color band. */
export function scoreTone(value: number): { text: string; bg: string; stroke: string } {
  if (value >= 80) return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", stroke: "stroke-emerald-500" };
  if (value >= 60) return { text: "text-primary", bg: "bg-primary", stroke: "stroke-primary" };
  if (value >= 40) return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", stroke: "stroke-amber-500" };
  return { text: "text-destructive", bg: "bg-destructive", stroke: "stroke-destructive" };
}

/** Circular SVG progress ring with a centered score. */
export function ScoreRing({
  value,
  label,
  size = 112,
  suffix = "",
}: {
  value: number;
  label?: string;
  size?: number;
  suffix?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  const tone = scoreTone(v);
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className={cn("transition-all", tone.stroke)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-2xl font-bold tabular-nums", tone.text)}>{v}{suffix}</span>
        </div>
      </div>
      {label && <p className="mt-2 text-center text-xs font-medium text-muted-foreground">{label}</p>}
    </div>
  );
}

/** Compact metric tile for a stat strip. */
export function StatCard({
  label,
  value,
  hint,
  accent,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <div className={cn("rounded-lg border bg-card p-4", href && "transition-colors hover:bg-muted")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", accent && "text-primary")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/** Labeled horizontal progress bar, colored by score band. */
export function MetricBar({
  label,
  value,
  max = 100,
  showValue = true,
  tone,
}: {
  label: React.ReactNode;
  value: number;
  max?: number;
  showValue?: boolean;
  tone?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  const color = tone ?? scoreTone(pct).bg;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate">{label}</span>
        {showValue && <span className="shrink-0 tabular-nums text-muted-foreground">{Math.round(value)}{max === 100 ? "" : `/${max}`}</span>}
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted">
        <div className={cn("h-2 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Bordered content section with an optional title row + CTA link. */
export function SectionCard({
  title,
  desc,
  href,
  cta,
  right,
  children,
  className,
}: {
  title?: React.ReactNode;
  desc?: string;
  href?: string;
  cta?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card p-5", className)}>
      {(title || href || right) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
          </div>
          {right}
          {href && cta && <Link href={href} className="shrink-0 text-xs text-primary hover:underline">{cta} →</Link>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Dashed empty-state placeholder. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">{children}</p>;
}

export type ChipTone = "neutral" | "ok" | "gap" | "primary" | "warn";
const CHIP_TONES: Record<ChipTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  ok: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  gap: "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

/** A single inline pill/badge. */
export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: ChipTone; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", CHIP_TONES[tone], className)}>{children}</span>;
}

/** Wraps a list of strings as chips, with an empty fallback. */
export function Chips({ items, tone = "neutral", empty }: { items: string[]; tone?: ChipTone; empty?: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty ?? "—"}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => <Badge key={s} tone={tone}>{s}</Badge>)}
    </div>
  );
}

/** Page header with title + optional description and right-aligned actions. */
export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** Amber info banner (used for "data not populated yet" notices). */
export function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-amber-400/40 bg-amber-50/50 p-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
      {children}
    </div>
  );
}
