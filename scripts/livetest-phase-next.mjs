/** Live end-to-end tests against the running dev server + Supabase. */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = "http://localhost:3000";

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}${detail ? " — " + detail : ""}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`); }
}
const post = async (path, body) => {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
};
const getHtml = async (path) => { const r = await fetch(BASE + path); return { status: r.status, html: await r.text() }; };

async function main() {
  const { data: opp } = await db.from("opportunities").select("id").eq("title", "AI Engineer").maybeSingle();
  const { data: resume } = await db.from("resumes").select("id").eq("label", "AI Engineer résumé").maybeSingle();

  // ---- TEST 1: Interview Kit Creation ----
  console.log("\n[1] Interview Kit Creation");
  const kit = await post("/api/interview/kit", { opportunityId: opp?.id, resumeId: resume?.id, persist: true });
  const qs = kit.json?.data?.questions ?? [];
  const kinds = new Set(qs.map((q) => q.kind));
  check("kit endpoint 200", kit.status === 200, `status ${kit.status}`);
  check("questions generated", qs.length >= 8, `${qs.length} questions`);
  check("all 4 categories present", ["technical", "behavioral", "hr", "project"].every((k) => kinds.has(k)), [...kinds].join(","));
  check("questions have difficulty + est time", qs.every((q) => q.difficulty && q.estimatedMinutes > 0));
  check("kit persisted (kitId)", !!kit.json?.data?.kitId, kit.json?.data?.kitId ?? "none");
  const kitId = kit.json?.data?.kitId;

  // ---- TEST 2: Question Storage ----
  console.log("\n[2] Question Storage");
  const { data: storedQs } = await db.from("interview_questions").select("kind,difficulty,question").eq("kit_id", kitId);
  check("questions stored in DB", (storedQs?.length ?? 0) === qs.length, `${storedQs?.length} rows`);
  check("stored categories match", new Set((storedQs ?? []).map((q) => q.kind)).size >= 4);
  const { data: kitRow } = await db.from("interview_kits").select("title,opportunity_id").eq("id", kitId).maybeSingle();
  check("kit row linked to opportunity", kitRow?.opportunity_id === opp?.id);

  // ---- TEST 3: Answer Evaluation (+ STAR) ----
  console.log("\n[3] Answer Evaluation");
  const strongStar = "Situation: our API was timing out under load. Task: I was responsible for cutting latency. Action: I profiled the code, added Redis caching, and refactored the slow query. Result: I reduced p95 latency by 60% and increased throughput 3x.";
  const evalStrong = await post("/api/interview/evaluate", { answer: strongStar, kind: "behavioral", question: "Tell me about a performance problem you solved.", expectedConcepts: [], persist: true });
  const s = evalStrong.json?.data;
  check("evaluate endpoint 200", evalStrong.status === 200);
  check("overall score 0-100", s?.scores?.overall >= 0 && s?.scores?.overall <= 100, `overall ${s?.scores?.overall}`);
  check("breakdown has 5 dims", ["communication", "technical", "confidence", "structure", "completeness"].every((k) => typeof s?.scores?.[k] === "number"));
  check("STAR detected all sections", s?.star?.situation && s?.star?.task && s?.star?.action && s?.star?.result, `STAR ${s?.star?.score}`);

  const weakStar = "I think I helped fix some stuff and it was maybe better after.";
  const evalWeak = await post("/api/interview/evaluate", { answer: weakStar, kind: "behavioral", question: "Tell me about a challenge.", persist: true });
  check("weak answer flags missing STAR sections", (evalWeak.json?.data?.star?.missing?.length ?? 0) > 0, `missing: ${evalWeak.json?.data?.star?.missing?.join(",")}`);
  check("weak answer scores lower than strong", evalWeak.json?.data?.scores?.overall < s?.scores?.overall, `${evalWeak.json?.data?.scores?.overall} < ${s?.scores?.overall}`);

  // Add a couple technical practice sessions to build readiness.
  await post("/api/interview/evaluate", { answer: "I built a RAG pipeline in Python using a vector database and FastAPI, reducing lookup time by 40% across 10000 documents.", kind: "technical", question: "Explain a Python project.", expectedConcepts: ["Python"], persist: true });

  // ---- verify analytics_events logged ----
  const { count: practiceCount } = await db.from("analytics_events").select("*", { count: "exact", head: true }).eq("type", "interview_practice");
  check("practice sessions logged to analytics_events", (practiceCount ?? 0) >= 3, `${practiceCount} events`);

  // ---- TEST 5: Skill Gap Generation ----
  console.log("\n[5] Skill Gap Generation");
  const gap = await post("/api/coach/skill-gap", { targetRole: "ai_engineer", persist: true });
  const g = gap.json?.data;
  const missingNames = (g?.missing ?? []).map((m) => m.skill);
  check("skill-gap endpoint 200", gap.status === 200);
  check("have includes Python", (g?.have ?? []).includes("Python"));
  check("missing includes role gaps (LLM/PyTorch/AWS)", ["LLM", "PyTorch", "AWS"].some((x) => missingNames.includes(x)), missingNames.join(","));
  check("missing skills carry difficulty + demand + priority", (g?.missing ?? []).every((m) => m.difficulty && m.demand >= 0 && m.priority >= 0));
  check("coverage is a percentage", g?.coverage >= 0 && g?.coverage <= 100, `${g?.coverage}%`);
  check("skill_gap_report persisted", !!g?.reportId);

  // ---- TEST 6: Roadmap Generation ----
  console.log("\n[6] Roadmap Generation");
  const rm = await post("/api/coach/roadmap", { targetRole: "ai_engineer", persist: true });
  const road = rm.json?.data;
  check("roadmap endpoint 200", rm.status === 200);
  check("12-week plan", (road?.weeks?.length ?? 0) === 12, `${road?.weeks?.length} weeks`);
  check("has 30/60/90 phases", (road?.phases?.length ?? 0) === 3 && road.phases.map((p) => p.id).join(",") === "30-day,60-day,90-day");
  check("weeks have focus + activity", (road?.weeks ?? []).every((w) => w.focus && w.activity));
  check("roadmap persisted to learning_roadmaps", !!road?.roadmapId);
  const { data: roadRow } = await db.from("learning_roadmaps").select("weeks,report_id").eq("id", road?.roadmapId).maybeSingle();
  check("stored roadmap has 12 weeks jsonb", Array.isArray(roadRow?.weeks) && roadRow.weeks.length === 12);

  // ---- coach chat ----
  console.log("\n[+] Career Coach chat");
  const chat = await post("/api/coach/chat", { message: "What should I learn next?" });
  check("chat endpoint 200", chat.status === 200);
  check("reply grounded (mentions a gap skill)", typeof chat.json?.data?.reply === "string" && chat.json.data.reply.length > 20, chat.json?.data?.reply?.slice(0, 60));
  check("coaching session created", !!chat.json?.data?.sessionId);
  const { count: msgCount } = await db.from("coaching_messages").select("*", { count: "exact", head: true }).eq("session_id", chat.json?.data?.sessionId);
  check("coaching_messages persisted (user+assistant)", (msgCount ?? 0) === 2, `${msgCount} messages`);

  // ---- TEST 4 + 7: Dashboard Rendering (readiness, gap, roadmap, analytics) ----
  console.log("\n[4+7] Dashboard Rendering & Career Readiness");
  const iv = await getHtml("/app/interview");
  check("/app/interview renders 200", iv.status === 200);
  check("interview page shows readiness", iv.html.includes("Interview Readiness") && iv.html.includes("Readiness breakdown"));
  check("interview page shows recent practice", iv.html.includes("Recent practice sessions"));

  const coach = await getHtml("/app/coach");
  check("/app/coach renders 200", coach.status === 200);
  check("coach shows Career Readiness", coach.html.includes("Career Readiness"));
  check("coach shows Skill Gap Engine", coach.html.includes("Skill Gap Engine"));
  check("coach shows Learning Roadmap", coach.html.includes("Learning Roadmap"));
  check("coach shows weekly + monthly goals", coach.html.includes("Weekly goals") && coach.html.includes("Monthly goals"));

  const an = await getHtml("/app/analytics");
  check("/app/analytics renders 200", an.status === 200);
  check("analytics shows funnel + conversion", an.html.includes("Application funnel") && an.html.includes("Conversion rate"));
  check("analytics shows trends", an.html.includes("Résumé score trend") && an.html.includes("Skill growth"));

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
