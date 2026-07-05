#!/usr/bin/env node
/**
 * Apply Assist — semi-automated job application helper.
 *
 *   npm run apply -- <opportunity-id or id-prefix> [--url <override-apply-url>]
 *
 * Opens the job's apply page in a real (headed) Chromium with a persistent
 * profile, pre-fills the form from your Career OS profile, attaches your
 * primary resume, and pastes the cover letter generated for that job.
 *
 * It NEVER clicks Submit. You review, answer anything custom (and any
 * CAPTCHA), and submit yourself; the script then logs the application in
 * your pipeline. Personal links live in scripts/apply-assist.config.json.
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { createInterface } from "node:readline/promises";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "scripts", "apply-assist.config.json");
const PROFILE_DIR = path.join(ROOT, "scripts", ".browser-profile");

// ---- env (.env.local) ----
function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) fail(".env.local not found — run from the project root.");
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
function fail(msg) { console.error(`\n✗ ${msg}`); process.exit(1); }
const log = (msg) => console.log(`  ${msg}`);

// ---- personal links config ----
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify({
      linkedin_url: "", github_url: "", portfolio_url: "", website_url: "",
      how_did_you_hear: "Job board",
    }, null, 2));
    console.log(`\nCreated ${CONFIG_PATH} — fill in your links once; they'll be used for every application.`);
  }
  try { return JSON.parse(readFileSync(CONFIG_PATH, "utf8")); } catch { return {}; }
}

// ---- data loading ----
async function findOpportunity(db, idArg) {
  if (/^[0-9a-f-]{36}$/i.test(idArg)) {
    const { data, error } = await db.from("opportunities").select("*").eq("id", idArg).single();
    if (error) fail(error.message);
    return data;
  }
  const { data, error } = await db.from("opportunities")
    .select("*").order("created_at", { ascending: false }).limit(500);
  if (error) fail(error.message);
  const hit = (data ?? []).filter((o) => o.id.startsWith(idArg.toLowerCase()));
  if (!hit.length) fail(`No opportunity id starts with "${idArg}".`);
  if (hit.length > 1) fail(`Ambiguous prefix "${idArg}" (${hit.length} matches) — use more characters.`);
  return hit[0];
}

async function downloadResume(db) {
  let { data: resume } = await db.from("resumes")
    .select("id,label,storage_path").eq("is_primary", true).maybeSingle();
  if (!resume) {
    const { data } = await db.from("resumes").select("id,label,storage_path")
      .not("storage_path", "is", null).order("created_at", { ascending: false }).limit(1);
    resume = data?.[0] ?? null;
  }
  if (!resume?.storage_path) return null;
  const { data: blob, error } = await db.storage.from("resumes").download(resume.storage_path);
  if (error || !blob) { log(`⚠ resume download failed: ${error?.message ?? "unknown"}`); return null; }
  const ext = path.extname(resume.storage_path) || ".pdf";
  const file = path.join(os.tmpdir(), `apply-assist-resume${ext}`);
  writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
  return { file, label: resume.label ?? path.basename(resume.storage_path) };
}

/** Snapshot the primary resume text as a resume_version (reused if unchanged),
 * so this application records exactly what was sent. */
async function snapshotResume(db) {
  const { data: resume } = await db.from("resumes")
    .select("id,target,parsed_text").eq("is_primary", true).maybeSingle();
  if (!resume?.parsed_text) return null;
  const { data: last } = await db.from("resume_versions")
    .select("id,version_no,content_md").eq("resume_id", resume.id)
    .order("version_no", { ascending: false }).limit(1).maybeSingle();
  if (last?.content_md === resume.parsed_text) return last.id;
  const { data: created } = await db.from("resume_versions").insert({
    resume_id: resume.id, version_no: (last?.version_no ?? 0) + 1,
    target: resume.target ?? "generic", content_md: resume.parsed_text, created_by_ai: false,
  }).select("id").single();
  return created?.id ?? null;
}

async function latestCoverLetter(db, opportunityId) {
  const { data } = await db.from("generated_documents")
    .select("content").eq("opportunity_id", opportunityId).eq("type", "cover_letter")
    .order("created_at", { ascending: false }).limit(1);
  return data?.[0]?.content ?? null;
}

// ---- form filling ----
async function fillFirst(page, selectors, value, report, what) {
  if (!value) return;
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.count() && await el.isVisible().catch(() => false)) {
        await el.fill(String(value), { timeout: 2000 });
        report.push(`✓ ${what}`);
        return;
      }
    } catch { /* try next selector */ }
  }
  report.push(`· ${what} — field not found (fill manually if the form asks)`);
}

function labelSelectors(patterns) {
  // input/textarea reachable via placeholder, aria-label, name or id containing the pattern
  return patterns.flatMap((p) => [
    `input[name*="${p}" i]`, `input[id*="${p}" i]`, `input[placeholder*="${p}" i]`, `input[aria-label*="${p}" i]`,
    `textarea[name*="${p}" i]`, `textarea[id*="${p}" i]`, `textarea[aria-label*="${p}" i]`,
  ]);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const urlFlag = args.indexOf("--url");
  const overrideUrl = urlFlag >= 0 ? args[urlFlag + 1] : null;
  const idArg = args.find((a) => !a.startsWith("--") && a !== overrideUrl);
  if (!idArg) fail("Usage: npm run apply -- <opportunity-id or prefix> [--url <apply-url>]");

  loadEnv();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const cfg = loadConfig();

  console.log("\nApply Assist — loading application context…");
  const opp = await findOpportunity(db, idArg);
  const applyUrl = overrideUrl ?? opp.apply_url ?? opp.url;
  if (!applyUrl) fail("This opportunity has no URL. Pass one with --url.");

  const [{ data: profile }, resumeFile, coverLetter] = await Promise.all([
    db.from("profiles").select("*").limit(1).maybeSingle(),
    downloadResume(db),
    latestCoverLetter(db, opp.id),
  ]);

  console.log(`\n  Job:      ${opp.title}${opp.company ? ` @ ${opp.company}` : ""}`);
  console.log(`  URL:      ${applyUrl}`);
  console.log(`  Resume:   ${resumeFile ? resumeFile.label : "none found (upload manually)"}`);
  console.log(`  Letter:   ${coverLetter ? "generated cover letter found" : "none for this job"}`);

  const fullName = profile?.full_name ?? "";
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ");

  mkdirSync(PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false, viewport: null, args: ["--start-maximized"],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500); // let embedded forms (Greenhouse/Lever iframeless) hydrate

  const report = [];
  await fillFirst(page, ["#first_name", ...labelSelectors(["first_name", "first-name", "firstname", "first name"])], firstName, report, "first name");
  await fillFirst(page, ["#last_name", ...labelSelectors(["last_name", "last-name", "lastname", "last name"])], lastName, report, "last name");
  await fillFirst(page, ['input[name="name"]', ...labelSelectors(["full name", "full_name"])], fullName, report, "full name");
  await fillFirst(page, ["#email", 'input[type="email"]', ...labelSelectors(["email"])], profile?.email, report, "email");
  await fillFirst(page, ["#phone", 'input[type="tel"]', ...labelSelectors(["phone"])], profile?.phone, report, "phone");
  await fillFirst(page, [...labelSelectors(["location", "city"])], profile?.location, report, "location");
  await fillFirst(page, ['input[name="org"]', ...labelSelectors(["current company", "organization"])], undefined, report, "current company");
  await fillFirst(page, ['input[name="urls[LinkedIn]"]', ...labelSelectors(["linkedin"])], cfg.linkedin_url, report, "LinkedIn URL");
  await fillFirst(page, ['input[name="urls[GitHub]"]', ...labelSelectors(["github"])], cfg.github_url, report, "GitHub URL");
  await fillFirst(page, ['input[name="urls[Portfolio]"]', ...labelSelectors(["portfolio"])], cfg.portfolio_url, report, "portfolio URL");
  await fillFirst(page, [...labelSelectors(["website"])], cfg.website_url || cfg.portfolio_url, report, "website URL");
  await fillFirst(page, ['textarea[name="comments"]', ...labelSelectors(["cover_letter", "cover letter", "coverletter"])], coverLetter, report, "cover letter");

  if (resumeFile) {
    try {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count()) { await fileInput.setInputFiles(resumeFile.file); report.push("✓ resume attached"); }
      else report.push("· resume — no file input found (attach manually)");
    } catch { report.push("· resume — attach manually"); }
  }

  // Make the submit button unmissable, but never click it.
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button[type="submit"], input[type="submit"], #submit_app')) {
      b.style.outline = "3px solid #f59e0b"; b.style.outlineOffset = "3px";
    }
  }).catch(() => {});

  console.log("\nPre-fill report:");
  for (const line of report) log(line);
  console.log("\n➜ Review the form in the browser, answer any custom questions, then click Submit yourself.");
  console.log("  (The submit button is highlighted amber. This tool never auto-submits.)\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Type "done" once you submitted, or "skip" to close without logging: ')).trim().toLowerCase();
  rl.close();
  await ctx.close();

  if (answer === "done") {
    const today = new Date().toISOString().slice(0, 10);
    const versionId = await snapshotResume(db);
    const { data: existing } = await db.from("applications")
      .select("id,status,resume_version_id").eq("opportunity_id", opp.id).maybeSingle();
    if (existing) {
      await db.from("applications").update({
        status: "applied", applied_at: today,
        resume_version_id: existing.resume_version_id ?? versionId,
      }).eq("id", existing.id);
    } else {
      await db.from("applications").insert({
        opportunity_id: opp.id, job_title: opp.title, company: opp.company,
        status: "applied", applied_at: today, source: "apply-assist",
        resume_version_id: versionId,
      });
    }
    console.log(`\n✓ Logged as applied (${today}) — visible in the Applications pipeline.`);
  } else {
    console.log("\nNothing logged.");
  }
}

main().catch((e) => fail(e?.message ?? String(e)));
