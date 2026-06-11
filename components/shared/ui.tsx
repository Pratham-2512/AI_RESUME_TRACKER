/**
 * Reusable presentational primitives shared across dashboards.
 * Pure (no hooks) — safe to render from both server and client components.
 * Uses the design tokens (card / border / muted / primary / success / warning /
 * destructive) so everything is mobile-responsive and dark-mode compatible.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Maps a 0-100 score to a semantic color band. */
export function scoreTone(value: number): { text: string; bg: string; stroke: string } {
  if (value >= 80) return { text: "text-success", bg: "bg-success", stroke: "stroke-success" };
  if (value >= 60) return { text: "text-primary", bg: "bg-primary", stroke: "stroke-primary" };
  if (value >= 40) return { text: "text-amber-600 dark:text-amber-400", bg: "bg-warning", stroke: "stroke-warning" };
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
  const stroke = Math.max(6, Math.round(size / 14));
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
            className={cn("transition-all duration-700 ease-out", tone.stroke)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold tabular-nums", tone.text)} style={{ fontSize: size / 4 }}>
            {v}{suffix}
          </span>
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
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: boolean;
  href?: string;
  icon?: React.ReactNode;
}) {
  const inner = (
    <div className={cn("card p-4 sm:p-5", href && "card-hover")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground/60 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      </div>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl", accent && "text-primary")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
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
        <span className="truncate font-medium">{label}</span>
        {showValue && <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{Math.round(value)}{max === 100 ? "" : `/${max}`}</span>}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-700 ease-out", color)} style={{ width: `${pct}%` }} />
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
    <section className={cn("card p-5 sm:p-6", className)}>
      {(title || href || right) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
          </div>
          {right}
          {href && cta && (
            <Link
              href={href}
              className="group inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              {cta}
              <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/** Dashed empty-state placeholder. */
export function Empty({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
      {icon && <span className="text-muted-foreground/50 [&>svg]:h-6 [&>svg]:w-6">{icon}</span>}
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export type ChipTone = "neutral" | "ok" | "gap" | "primary" | "warn";
const CHIP_TONES: Record<ChipTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  ok: "bg-success/10 text-success",
  gap: "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary",
  warn: "bg-warning/10 text-amber-700 dark:text-amber-400",
};

/** A single inline pill/badge. */
export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: ChipTone; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", CHIP_TONES[tone], className)}>{children}</span>;
}

/** Wraps a list of strings as chips, with an empty fallback. */
export function Chips({ items, tone = "neutral", empty }: { items: string[]; tone?: ChipTone; empty?: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty ?? "—"}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => <Badge key={s} tone={tone}>{s}</Badge>)}
    </div>
  );
}

/** Page header with title + optional description and right-aligned actions. */
export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {desc && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{desc}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** Amber info banner (used for "data not populated yet" notices). */
export function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
      <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/** Red error banner. */
export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">
      {children}
    </div>
  );
}

/** Shimmering loading placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** Animated "AI thinking" indicator for long-running analysis. */
export function ThinkingState({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="card animate-scale-in p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-primary" />
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-primary [animation-delay:200ms]" />
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-primary [animation-delay:400ms]" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
        </div>
      </div>
      <div className="mt-5 space-y-2.5">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}
