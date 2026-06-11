"use client";

import { useState, useTransition } from "react";
import {
  updateProfile, reembedProfile,
  addSkill, deleteSkill, addExperience, deleteExperience,
} from "@/actions/profile";
import { cn } from "@/lib/utils";

type Skill = { id: string; name: string; category: string | null; proficiency: number | null; years: number | null };
type Experience = { id: string; company: string; title: string; start_date: string | null; end_date: string | null; is_current: boolean | null; description: string | null };
type Profile = {
  full_name: string | null; phone: string | null; location: string | null;
  headline: string | null; summary: string | null; career_goals: string | null;
  target_roles: string[] | null; years_experience: number | null;
};

const TABS = ["Personal", "Skills", "Experience"] as const;

export function ProfileEditor({
  profile, skills, experience,
}: {
  profile: Profile; skills: Skill[]; experience: Experience[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Personal");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div>
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {msg && <p className="mt-3 text-sm text-primary">{msg}</p>}

      <div className="mt-5">
        {tab === "Personal" && <PersonalTab profile={profile} onSaved={() => setMsg("Saved.")} />}
        {tab === "Skills" && <SkillsTab skills={skills} />}
        {tab === "Experience" && <ExperienceTab experience={experience} />}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
const inputCls = "field";

function PersonalTab({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "", phone: profile.phone ?? "",
    location: profile.location ?? "", headline: profile.headline ?? "",
    years_experience: profile.years_experience?.toString() ?? "",
    target_roles: (profile.target_roles ?? []).join(", "),
    summary: profile.summary ?? "", career_goals: profile.career_goals ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  function save() {
    start(async () => {
      await updateProfile({
        full_name: form.full_name, phone: form.phone, location: form.location,
        headline: form.headline, summary: form.summary, career_goals: form.career_goals,
        years_experience: form.years_experience ? Number(form.years_experience) : undefined,
        target_roles: form.target_roles ? form.target_roles.split(",").map((s) => s.trim()).filter(Boolean) : [],
      });
      await reembedProfile();
      onSaved();
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name"><input className={inputCls} value={form.full_name} onChange={set("full_name")} /></Field>
      <Field label="Phone"><input className={inputCls} value={form.phone} onChange={set("phone")} /></Field>
      <Field label="Location"><input className={inputCls} value={form.location} onChange={set("location")} /></Field>
      <Field label="Years of experience"><input className={inputCls} type="number" value={form.years_experience} onChange={set("years_experience")} /></Field>
      <div className="sm:col-span-2"><Field label="Headline"><input className={inputCls} value={form.headline} onChange={set("headline")} placeholder="e.g. Data Analyst → ML Engineer" /></Field></div>
      <div className="sm:col-span-2"><Field label="Target roles (comma-separated)"><input className={inputCls} value={form.target_roles} onChange={set("target_roles")} placeholder="ML Engineer, Data Scientist" /></Field></div>
      <div className="sm:col-span-2"><Field label="Summary"><textarea className={inputCls} rows={4} value={form.summary} onChange={set("summary")} /></Field></div>
      <div className="sm:col-span-2"><Field label="Career goals"><textarea className={inputCls} rows={3} value={form.career_goals} onChange={set("career_goals")} /></Field></div>
      <div className="sm:col-span-2">
        <button onClick={save} disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save & re-embed"}
        </button>
      </div>
    </div>
  );
}

function SkillsTab({ skills }: { skills: Skill[] }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [prof, setProf] = useState("3");

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <span key={s.id} className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm">
            {s.name}{s.proficiency ? ` · ${"●".repeat(s.proficiency)}` : ""}
            <button onClick={() => start(async () => { await deleteSkill(s.id); })} className="text-destructive" aria-label="remove">×</button>
          </span>
        ))}
        {skills.length === 0 && <p className="text-sm text-muted-foreground">No skills yet.</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a skill (e.g. Python)" />
        <select className="field w-auto px-2 py-1" value={prof} onChange={(e) => setProf(e.target.value)}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button
          disabled={pending || !name.trim()}
          onClick={() => start(async () => { await addSkill({ name, proficiency: Number(prof) }); await reembedProfile(); setName(""); })}
          className="btn-primary"
        >Add</button>
      </div>
    </div>
  );
}

function ExperienceTab({ experience }: { experience: Experience[] }) {
  const [pending, start] = useTransition();
  const [f, setF] = useState({ company: "", title: "", start_date: "", end_date: "", description: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-4">
      {experience.map((x) => (
        <div key={x.id} className="card p-4">
          <div className="flex justify-between">
            <div>
              <p className="font-semibold">{x.title} · {x.company}</p>
              <p className="text-sm text-muted-foreground">{x.start_date ?? "?"} — {x.is_current ? "Present" : x.end_date ?? "?"}</p>
            </div>
            <button onClick={() => start(async () => { await deleteExperience(x.id); })} className="text-sm text-destructive">Remove</button>
          </div>
          {x.description && <p className="mt-2 text-sm">{x.description}</p>}
        </div>
      ))}
      <div className="rounded-lg border border-dashed p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputCls} placeholder="Title" value={f.title} onChange={set("title")} />
          <input className={inputCls} placeholder="Company" value={f.company} onChange={set("company")} />
          <input className={inputCls} type="date" value={f.start_date} onChange={set("start_date")} />
          <input className={inputCls} type="date" value={f.end_date} onChange={set("end_date")} />
          <div className="sm:col-span-2"><textarea className={inputCls} rows={2} placeholder="What you did / impact" value={f.description} onChange={set("description")} /></div>
        </div>
        <button
          disabled={pending || !f.title.trim() || !f.company.trim()}
          onClick={() => start(async () => { await addExperience(f); await reembedProfile(); setF({ company: "", title: "", start_date: "", end_date: "", description: "" }); })}
          className="mt-3 btn-primary"
        >Add experience</button>
      </div>
    </div>
  );
}
