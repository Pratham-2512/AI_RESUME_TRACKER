/**
 * Deterministic job-match engine. No LLM required — works offline.
 * Parses a job description, extracts skills/requirements, and scores fit against
 * the candidate's skills. Upgradeable: an LLM layer can refine these later, but
 * this guarantees the Opportunities page is useful with zero API keys.
 */
import type { ResumeTarget } from "@/lib/supabase/database.types";

// Canonical skill -> regex alias list. Lowercase matching.
const SKILLS: Record<string, string[]> = {
  Python: ["python"], JavaScript: ["javascript", "\\bjs\\b"], TypeScript: ["typescript", "\\bts\\b"],
  Java: ["\\bjava\\b"], Go: ["\\bgolang\\b", "\\bgo\\b"], "C++": ["c\\+\\+"], SQL: ["\\bsql\\b"],
  React: ["react", "react.js", "reactjs"], "Next.js": ["next.js", "nextjs"], "Node.js": ["node.js", "nodejs", "node"],
  "Vue": ["vue", "vue.js"], Angular: ["angular"], "Tailwind": ["tailwind"],
  Django: ["django"], Flask: ["flask"], FastAPI: ["fastapi", "fast api"], "Express": ["express"],
  PostgreSQL: ["postgres", "postgresql"], MySQL: ["mysql"], MongoDB: ["mongodb", "mongo"], Redis: ["redis"],
  Docker: ["docker"], Kubernetes: ["kubernetes", "k8s"], AWS: ["\\baws\\b", "amazon web services"],
  GCP: ["\\bgcp\\b", "google cloud"], Azure: ["azure"], Terraform: ["terraform"], "CI/CD": ["ci/cd", "cicd"],
  Pandas: ["pandas"], NumPy: ["numpy"], "scikit-learn": ["scikit-learn", "sklearn", "scikit learn"],
  PyTorch: ["pytorch"], TensorFlow: ["tensorflow"], Keras: ["keras"], "LLM": ["\\bllm\\b", "large language model"],
  NLP: ["\\bnlp\\b", "natural language processing"], "Computer Vision": ["computer vision", "opencv"],
  "Machine Learning": ["machine learning", "\\bml\\b"], "Deep Learning": ["deep learning"],
  "Data Analysis": ["data analysis", "data analytics"], Tableau: ["tableau"], "Power BI": ["power bi", "powerbi"],
  Excel: ["excel"], Statistics: ["statistics", "statistical"], "A/B Testing": ["a/b test", "ab testing"],
  Spark: ["spark", "pyspark"], Airflow: ["airflow"], Kafka: ["kafka"], "ETL": ["\\betl\\b"], Snowflake: ["snowflake"],
  GraphQL: ["graphql"], REST: ["\\brest\\b", "restful"], Git: ["\\bgit\\b"], Linux: ["linux"],
  "System Design": ["system design"], Microservices: ["microservice"], RAG: ["\\brag\\b", "retrieval augmented"],
  "Vector DB": ["vector database", "pinecone", "pgvector", "weaviate"], HTML: ["html"], CSS: ["css"],
};

// Role -> defining skills, for recommending which résumé version to use.
const ROLE_SKILLS: Record<string, string[]> = {
  ai_engineer: ["LLM", "RAG", "Python", "PyTorch", "NLP", "Vector DB"],
  ml_engineer: ["Machine Learning", "PyTorch", "TensorFlow", "Python", "Deep Learning", "scikit-learn"],
  data_scientist: ["Python", "Statistics", "Machine Learning", "Pandas", "SQL", "Data Analysis"],
  data_analyst: ["SQL", "Data Analysis", "Tableau", "Power BI", "Excel", "Statistics"],
  python_developer: ["Python", "Django", "Flask", "FastAPI", "SQL", "REST"],
  full_stack: ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "REST"],
  software_developer: ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "System Design"],
};

export type Requirements = { skills: string[]; yearsRequired: number | null; keywords: string[] };

export function extractRequirements(text: string): Requirements {
  const lower = text.toLowerCase();
  const skills = Object.entries(SKILLS)
    .filter(([, aliases]) => aliases.some((a) => new RegExp(a, "i").test(lower)))
    .map(([canonical]) => canonical);

  // Years of experience: "3+ years", "5 years", "minimum 2 years"
  let yearsRequired: number | null = null;
  const m = lower.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/);
  if (m) yearsRequired = parseInt(m[1], 10);

  return { skills, yearsRequired, keywords: skills };
}

export type MatchResult = {
  matchScore: number;
  interviewProbability: { label: string; pct: number };
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
  strategy: string;
  recommendedResume: ResumeTarget;
  requirements: Requirements;
};

export function scoreMatch(opts: {
  jobText: string;
  candidateSkills: string[];
  candidateYears?: number | null;
  /** Job title + target roles enable a role-fit signal (used by the feed). */
  title?: string;
  targetRoles?: string[];
}): MatchResult {
  const requirements = extractRequirements(opts.jobText);
  const have = new Set(opts.candidateSkills.map((s) => s.toLowerCase().trim()));
  const req = requirements.skills;

  const matchedSkills = req.filter((s) => have.has(s.toLowerCase()));
  const missingSkills = req.filter((s) => !have.has(s.toLowerCase()));

  // Base score = proportion of required skills the candidate has (skill coverage).
  let score = req.length ? Math.round((matchedSkills.length / req.length) * 100) : 50;

  // Low-evidence cap: full coverage of a 1–2 skill JD is weak evidence, not a
  // 100% match (a copywriter JD mentioning only Excel must not outrank real
  // engineering matches).
  if (req.length === 1) score = Math.min(score, 55);
  else if (req.length === 2) score = Math.min(score, 70);

  // Experience adjustment.
  if (requirements.yearsRequired != null && opts.candidateYears != null) {
    if (opts.candidateYears >= requirements.yearsRequired) score = Math.min(100, score + 5);
    else if (opts.candidateYears < requirements.yearsRequired - 2) score = Math.max(0, score - 15);
    else score = Math.max(0, score - 5);
  }

  // Role-fit adjustment: reward titles inside the candidate's target roles,
  // penalize titles with zero overlap.
  if (opts.title && opts.targetRoles?.length) {
    const targetWords = new Set(
      opts.targetRoles.flatMap((r) => r.toLowerCase().split(/\s+/)).filter((w) => w.length > 2),
    );
    const overlap = opts.title.toLowerCase().split(/[^a-z+#.]+/).filter((w) => targetWords.has(w)).length;
    if (overlap >= 2) score = Math.min(100, score + 10);
    else if (overlap === 1) score = Math.min(100, score + 5);
    else score = Math.max(0, score - 20);
  }

  const interviewProbability = probability(score);
  const recommendedResume = recommendResume(req);

  const strengths = matchedSkills.slice(0, 6);
  const weaknesses = missingSkills.slice(0, 6);
  const strategy = buildStrategy(score, missingSkills, requirements.yearsRequired, opts.candidateYears ?? null);

  return {
    matchScore: score, interviewProbability, matchedSkills, missingSkills,
    strengths, weaknesses, strategy, recommendedResume, requirements,
  };
}

function probability(score: number): { label: string; pct: number } {
  if (score >= 80) return { label: "High", pct: 65 };
  if (score >= 60) return { label: "Medium", pct: 40 };
  if (score >= 40) return { label: "Low", pct: 20 };
  return { label: "Very low", pct: 8 };
}

function recommendResume(reqSkills: string[]): ResumeTarget {
  let best: ResumeTarget = "ats";
  let bestHits = 0;
  for (const [role, skills] of Object.entries(ROLE_SKILLS)) {
    const hits = skills.filter((s) => reqSkills.includes(s)).length;
    if (hits > bestHits) { bestHits = hits; best = role as ResumeTarget; }
  }
  return bestHits >= 2 ? best : "ats";
}

function buildStrategy(score: number, missing: string[], yearsReq: number | null, candYears: number | null): string {
  const parts: string[] = [];
  if (score >= 80) parts.push("Strong fit - apply now and tailor your resume to mirror the JD's exact keywords.");
  else if (score >= 60) parts.push("Solid fit - apply, but close the top gaps and emphasize transferable experience.");
  else if (score >= 40) parts.push("Stretch role - apply only if you can credibly cover the gaps; lead with your strongest matching projects.");
  else parts.push("Low fit - invest in the missing skills before applying, or target a closer role.");
  if (missing.length) parts.push(`Address in your resume/cover letter: ${missing.slice(0, 4).join(", ")}.`);
  if (yearsReq != null && candYears != null && candYears < yearsReq) {
    parts.push(`They want ${yearsReq}y; you have ${candYears}y - counter with depth/impact, not tenure.`);
  }
  return parts.join(" ");
}
