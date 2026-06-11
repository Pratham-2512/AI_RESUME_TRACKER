"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCareerGoal, recordLearningProgress } from "@/actions/copilot";

type LearningEntry = { skill: string; status: string; at: string };
type Memory = {
  careerGoal: string | null;
  targetRole: string | null;
  targetRoleLabel: string;
  learning: LearningEntry[];
  recentTopics: string[];
  lastInteractionAt: string | null;
};

const ROLES = [
  ["ai_engineer", "AI Engineer"], ["ml_engineer", "ML Engineer"], ["data_analyst", "Data Analyst"],
  ["data_scientist", "Data Scientist"], ["full_stack", "Full-Stack Developer"], ["python_developer", "Python Developer"],
] as const;

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  started: "bg-muted text-muted-foreground",
};

export function MemoryPanel({ memory }: { memory: Memory }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [goal, setGoal] = useState(memory.careerGoal ?? "");
  const [role, setRole] = useState(memory.targetRole ?? "ai_engineer");
  const [skill, setSkill] = useState("");
  const [status, setStatus] = useState<"started" | "in_progress" | "completed">("in_progress");
  const [msg, setMsg] = useState<string | null>(null);

  function saveGoal() {
    start(async () => {
      setMsg(null);
      try { await saveCareerGoal({ goal, targetRole: role }); setMsg("Saved ✓"); router.refresh(); }
      catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    });
  }
  function logSkill() {
    if (!skill.trim()) return;
    start(async () => {
      setMsg(null);
      try { await recordLearningProgress({ skill, status }); setSkill(""); setMsg("Logged ✓"); router.refresh(); }
      catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    });
  }

  return (
    <div className="space-y-4">
      {/* Career goal + target role */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Career goal</label>
        <textarea
          rows={2} value={goal} onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Become a senior AI engineer at a product company within 12 months"
          className="mt-1 field"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={role} onChange={(e) => setRole(e.target.value)} className="field w-auto px-2 py-1.5">
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={saveGoal} disabled={pending} className="btn-primary btn-sm">
            {pending ? "Saving…" : "Save memory"}
          </button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </div>

      {/* Log learning progress */}
      <div className="border-t pt-3">
        <label className="text-xs font-medium text-muted-foreground">Log learning progress</label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="Skill (e.g. AWS)" className="field flex-1" />
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="field w-auto px-2 py-1.5">
            <option value="started">Started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={logSkill} disabled={pending} className="btn-outline btn-sm">Log</button>
        </div>
      </div>

      {/* Persisted learning progress */}
      {memory.learning.length > 0 && (
        <div className="border-t pt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tracked skills</p>
          <div className="flex flex-wrap gap-2">
            {memory.learning.map((l) => (
              <span key={l.skill} className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLE[l.status] ?? STATUS_STYLE.started}`}>
                {l.skill} · {l.status.replace("_", " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recalled coaching context */}
      {memory.recentTopics.length > 0 && (
        <div className="border-t pt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Remembered from recent chats</p>
          <ul className="space-y-1">
            {memory.recentTopics.map((t, i) => <li key={i} className="truncate text-sm text-muted-foreground">• {t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
