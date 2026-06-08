/**
 * Seed realistic test data for the Interview Prep Suite + Career Coach.
 * Idempotent-ish: clears the rows it owns, then inserts a fresh fixture set.
 * Usage:  node scripts/seed-phase-next.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- load .env.local (no dotenv dependency) ---
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OWNER = process.env.OWNER_ID ?? "00000000-0000-0000-0000-000000000001";

async function main() {
  // 1) Profile → target an AI Engineer role.
  await db.from("profiles").update({
    full_name: "Aashna Sharma",
    headline: "Aspiring AI Engineer · Python · LLMs",
    target_roles: ["ai_engineer", "ml_engineer"],
    years_experience: 2,
    summary: "Builder focused on LLM apps and data pipelines.",
  }).eq("id", OWNER);

  // 2) Skills (some role-matching, some gaps remain).
  const skills = ["Python", "SQL", "Pandas", "FastAPI", "Docker", "Git", "REST", "NLP"];
  await db.from("skills").delete().neq("name", "__none__");
  await db.from("skills").insert(skills.map((name) => ({ name, category: "domain", proficiency: 3 })));

  // 3) Projects.
  await db.from("projects").delete().neq("name", "__none__");
  await db.from("projects").insert([
    { name: "Resume RAG Assistant", description: "RAG chatbot over personal docs", tech_stack: ["Python", "FastAPI", "Vector DB"], highlights: ["Cut lookup time by 40%"] },
    { name: "Sales Forecast Pipeline", description: "ETL + model", tech_stack: ["Python", "Pandas", "SQL"], highlights: ["Improved forecast accuracy 18%"] },
  ]);

  // 4) An opportunity to anchor an interview kit + market demand.
  await db.from("opportunities").delete().neq("title", "__none__");
  const { data: opp } = await db.from("opportunities").insert({
    title: "AI Engineer", company: "Vectorly", source: "seed",
    job_text: "We need an AI Engineer with Python, LLM, RAG, PyTorch, Docker, and AWS experience. 3+ years.",
    required_skills: ["Python", "LLM", "RAG", "PyTorch", "Docker", "AWS"], years_required: 3,
    match_score: 62, status: "saved",
  }).select("id").single();

  // 5) A résumé with parsed text.
  await db.from("resumes").delete().neq("label", "__none__");
  const { data: resume } = await db.from("resumes").insert({
    label: "AI Engineer résumé", target: "ai_engineer", status: "ready",
    parsed_text: [
      "EXPERIENCE",
      "- Built an LLM-powered RAG assistant in Python and FastAPI, reducing lookup time by 40%.",
      "- Developed an ETL pipeline with Pandas and SQL improving forecast accuracy by 18%.",
      "SKILLS", "Python, SQL, Pandas, FastAPI, Docker, Git, REST, NLP",
      "EDUCATION", "B.Tech Computer Science",
    ].join("\n"),
    is_primary: true,
  }).select("id").single();

  // 6) A résumé version (for ATS / readiness trend) and applications (for funnel).
  if (resume?.id) {
    await db.from("resume_versions").delete().eq("resume_id", resume.id);
    await db.from("resume_versions").insert([
      { resume_id: resume.id, version_no: 1, target: "ai_engineer", ats_score: 68, content_md: "v1" },
      { resume_id: resume.id, version_no: 2, target: "ai_engineer", ats_score: 81, content_md: "v2" },
    ]);
  }

  await db.from("applications").delete().neq("status", "__none__");
  await db.from("applications").insert([
    { job_title: "AI Engineer", company: "Vectorly", status: "interview", opportunity_id: opp?.id ?? null },
    { job_title: "ML Engineer", company: "DataCo", status: "applied" },
    { job_title: "Python Dev", company: "Acme", status: "assessment" },
    { job_title: "AI Eng", company: "Foo", status: "offer" },
    { job_title: "Data Sci", company: "Bar", status: "rejected" },
  ]);

  // Clear prior generated artifacts so counts are clean for the test run.
  await db.from("interview_kits").delete().neq("title", "__none__");
  await db.from("learning_roadmaps").delete().neq("title", "__none__");
  await db.from("skill_gap_reports").delete().neq("scope", "__none__");
  await db.from("coaching_sessions").delete().neq("title", "__none__");
  await db.from("analytics_events").delete().eq("type", "interview_practice");

  console.log(JSON.stringify({ ok: true, opportunityId: opp?.id, resumeId: resume?.id }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
