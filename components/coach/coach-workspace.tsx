"use client";

import { useState } from "react";
import { Badge, ChipTone, Empty, MetricBar, SectionCard } from "@/components/shared/ui";
import { cn } from "@/lib/utils";

type GapSkill = { skill: string; difficulty: "easy" | "medium" | "hard"; demand: number; priority: number; category: string; learn: string };
type SkillGap = { targetRole: string; targetRoleLabel: string; have: string[]; missing: GapSkill[]; prioritySkills: string[]; coverage: number; extraSkills: string[] };
type RoadmapWeek = { week: number; phase: "30-day" | "60-day" | "90-day"; focus: string; skills: string[]; activity: string };
type Roadmap = { targetRole: string; targetRoleLabel: string; weeks: RoadmapWeek[]; phases: { id: string; label: string; weeks: RoadmapWeek[] }[] };

const DIFF_TONE: Record<GapSkill["difficulty"], ChipTone> = { easy: "ok", medium: "warn", hard: "gap" };

export function CoachWorkspace({
  initialGap,
  initialRoadmap,
  roleOptions,
}: {
  initialGap: SkillGap;
  initialRoadmap: Roadmap;
  roleOptions: { value: string; label: string }[];
}) {
  const [role, setRole] = useState(initialGap.targetRole);
  const [gap, setGap] = useState(initialGap);
  const [roadmap, setRoadmap] = useState(initialRoadmap);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function changeRole(next: string) {
    setRole(next); setBusy(true); setErr(null); setSaved(false);
    try {
      const r = await fetch("/api/coach/roadmap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetRole: next }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setRoadmap(j.data);
      setGap(j.data.gap);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to load role"); }
    finally { setBusy(false); }
  }

  async function saveRoadmap() {
    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/coach/roadmap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetRole: role, persist: true }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setSaved(true);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      {/* Skill gap */}
      <SectionCard
        title="Skill Gap Engine"
        desc={`Coverage for ${gap.targetRoleLabel}: ${gap.coverage}%`}
        right={
          <select value={role} onChange={(e) => changeRole(e.target.value)} disabled={busy}
            className="rounded-md border bg-background px-2.5 py-1.5 text-xs">
            {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        }
      >
        <div className={cn("transition-opacity", busy && "opacity-50")}>
          <MetricBar label={`Role skill coverage`} value={gap.coverage} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skills you have ({gap.have.length})</p>
              {gap.have.length ? <div className="flex flex-wrap gap-2">{gap.have.map((s) => <Badge key={s} tone="ok">{s}</Badge>)}</div> : <Empty>No matching role skills yet.</Empty>}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skills to learn ({gap.missing.length})</p>
              {gap.missing.length ? <div className="flex flex-wrap gap-2">{gap.missing.map((m) => <Badge key={m.skill} tone="gap">{m.skill}</Badge>)}</div> : <Empty>You cover all the core role skills.</Empty>}
            </div>
          </div>

          {gap.missing.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority skills · difficulty · market demand</p>
              <div className="space-y-2">
                {gap.missing.slice(0, 8).map((m, i) => (
                  <div key={m.skill} className="flex items-center gap-3 rounded-md border p-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{m.skill}</span>
                        <Badge tone={DIFF_TONE[m.difficulty]}>{m.difficulty}</Badge>
                        <span className="text-xs text-muted-foreground">{m.category}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.learn}</p>
                    </div>
                    <div className="w-24 shrink-0"><MetricBar label="" value={m.demand} showValue={false} /></div>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{m.demand}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Roadmap */}
      <SectionCard
        title="Learning Roadmap"
        desc={`12-week plan for ${roadmap.targetRoleLabel}`}
        right={
          <button onClick={saveRoadmap} disabled={saving}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save roadmap"}
          </button>
        }
      >
        {err && <p className="mb-3 text-sm text-destructive">{err}</p>}
        <div className={cn("grid gap-4 lg:grid-cols-3", busy && "opacity-50")}>
          {roadmap.phases.map((ph) => (
            <div key={ph.id} className="rounded-lg border p-4">
              <p className="mb-3 text-sm font-semibold">{ph.label}</p>
              <ol className="space-y-3">
                {ph.weeks.map((w) => (
                  <li key={w.week} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{w.week}</span>
                      <span className="font-medium">{w.focus}</span>
                    </div>
                    <p className="mt-0.5 pl-7 text-xs text-muted-foreground">{w.activity}</p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
