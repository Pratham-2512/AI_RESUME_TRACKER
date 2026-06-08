/**
 * Interview engine — deterministic, no LLM.
 * Generates relevant questions from JD skills + question banks + résumé projects,
 * evaluates answers (communication / technical / confidence / structure), and
 * computes readiness. LLM enrichment can layer on later; this works with no key.
 */
export type QuestionKind = "technical" | "behavioral" | "hr" | "project";

export type Difficulty = "easy" | "medium" | "hard";

export type GeneratedQuestion = {
  kind: QuestionKind;
  difficulty: Difficulty;
  question: string;
  suggested_answer: string;     // guidance, never fabricated personal facts
  expected_concepts: string[];  // used by the evaluator
  confidence: number;           // how well the candidate's profile supports a strong answer
  estimatedMinutes: number;     // expected spoken answer length
};

/** Deterministic answer-time estimate from question kind + difficulty. */
export function estimatedMinutes(kind: QuestionKind, difficulty: Difficulty): number {
  if (kind === "hr") return 1;
  if (kind === "behavioral") return 3;
  if (kind === "project") return 5;
  // technical
  return difficulty === "hard" ? 5 : difficulty === "easy" ? 1 : 3;
}

const BEHAVIORAL = [
  "Tell me about a time you faced a tight deadline. How did you handle it?",
  "Describe a conflict with a teammate and how you resolved it.",
  "Tell me about a project that didn't go as planned. What did you learn?",
  "Describe a time you took initiative beyond your assigned role.",
  "Give an example of feedback you received and how you acted on it.",
];
const HR = [
  "Why do you want this role, and why now?",
  "Where do you see yourself in three years?",
  "What are your salary expectations for this position?",
  "What's your biggest strength, and a real weakness you're improving?",
];

export function generateQuestions(opts: {
  jdSkills: string[];
  candidateSkills: string[];
  projects: string[];
}): GeneratedQuestion[] {
  const have = new Set(opts.candidateSkills.map((s) => s.toLowerCase()));
  const out: GeneratedQuestion[] = [];

  // Technical — from JD skills
  for (const skill of opts.jdSkills.slice(0, 6)) {
    const hasIt = have.has(skill.toLowerCase());
    const difficulty: Difficulty = hasIt ? "medium" : "hard";
    out.push({
      kind: "technical", difficulty,
      question: `Walk me through how you've used ${skill} in a real project — the problem, your approach, and the outcome.`,
      suggested_answer: `Anchor to a concrete project. State the problem, what you built with ${skill}, a key decision/tradeoff, and a measurable result. Use precise ${skill} terminology.`,
      expected_concepts: [skill],
      confidence: hasIt ? 75 : 30,
      estimatedMinutes: estimatedMinutes("technical", difficulty),
    });
  }
  // One depth question on the top JD skill
  if (opts.jdSkills[0]) {
    out.push({
      kind: "technical", difficulty: "hard",
      question: `What are common pitfalls or performance considerations when working with ${opts.jdSkills[0]}?`,
      suggested_answer: `Name 2–3 concrete pitfalls and how you mitigate them; reference real debugging/optimization you've done.`,
      expected_concepts: [opts.jdSkills[0]],
      confidence: have.has(opts.jdSkills[0].toLowerCase()) ? 70 : 35,
      estimatedMinutes: estimatedMinutes("technical", "hard"),
    });
  }
  // Behavioral
  for (const q of BEHAVIORAL.slice(0, 4)) {
    out.push({ kind: "behavioral", difficulty: "medium", question: q,
      suggested_answer: "Use STAR: Situation, Task, Action, Result. Keep it to ~90 seconds and quantify the result.",
      expected_concepts: ["situation", "action", "result"], confidence: 60,
      estimatedMinutes: estimatedMinutes("behavioral", "medium") });
  }
  // HR
  for (const q of HR.slice(0, 3)) {
    out.push({ kind: "hr", difficulty: "easy", question: q,
      suggested_answer: "Be specific and honest; tie your answer back to the role and your genuine motivations.",
      expected_concepts: [], confidence: 65,
      estimatedMinutes: estimatedMinutes("hr", "easy") });
  }
  // Project
  const projList = opts.projects.length ? opts.projects.slice(0, 2) : ["your most impactful project"];
  for (const p of projList) {
    out.push({ kind: "project", difficulty: "medium",
      question: `Deep-dive into ${p}: your specific role, the hardest technical decision, and the measurable outcome.`,
      suggested_answer: "Lead with your individual contribution (not the team's), explain one hard tradeoff, and end with a quantified result.",
      expected_concepts: [], confidence: 60,
      estimatedMinutes: estimatedMinutes("project", "medium") });
  }
  return out;
}

// ---- Answer evaluation ----
const HEDGES = ["maybe", "i think", "kind of", "sort of", "not sure", "probably", "i guess", "um", "uh"];
const QUANT = /\d+\s*%|\$\s*\d|\b\d{2,}\b|\b\d+\s*(x|users|customers|hours|days|requests|ms)\b/i;

export type AnswerScores = { communication: number; technical: number; confidence: number; structure: number; completeness: number; overall: number };
export type Evaluation = { scores: AnswerScores; feedback: string[]; wordCount: number; star?: StarCheck };

export function evaluateAnswer(opts: { answer: string; kind: QuestionKind; expectedConcepts: string[] }): Evaluation {
  const text = opts.answer.trim();
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const feedback: string[] = [];

  // Communication — length band + sentence presence
  let communication = 100;
  if (wc < 30) { communication = Math.max(20, Math.round((wc / 30) * 70)); feedback.push("Answer is short — aim for 60–150 words."); }
  else if (wc > 250) { communication = 70; feedback.push("Answer is long — tighten it for a spoken response."); }
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  if (sentences < 2 && wc > 20) communication = Math.min(communication, 60);

  // Technical accuracy — coverage of expected concepts (or substance for non-technical)
  let technical: number;
  if (opts.expectedConcepts.length) {
    const hit = opts.expectedConcepts.filter((c) => lower.includes(c.toLowerCase())).length;
    technical = Math.round((hit / opts.expectedConcepts.length) * 100);
    if (technical < 50) feedback.push(`Mention the key concept(s): ${opts.expectedConcepts.join(", ")}.`);
  } else {
    technical = wc >= 40 ? 75 : 50; // non-technical: substance proxy
  }

  // Confidence — penalize hedging, reward quantification
  const hedgeCount = HEDGES.reduce((n, h) => n + (lower.split(h).length - 1), 0);
  let confidence = Math.max(20, 95 - hedgeCount * 12);
  if (QUANT.test(text)) confidence = Math.min(100, confidence + 5);
  if (hedgeCount >= 2) feedback.push("Reduce hedging language ('I think', 'maybe') — be assertive.");

  // Structure — STAR cues for behavioral/project; steps/examples for technical
  let structure: number;
  if (opts.kind === "behavioral" || opts.kind === "project") {
    const cues = ["situation", "task", "action", "result", "because", "so that", "led to", "resulted"];
    const hits = cues.filter((c) => lower.includes(c)).length;
    structure = Math.min(100, 40 + hits * 15);
    if (hits < 2) feedback.push("Use a clear STAR structure (Situation → Task → Action → Result).");
  } else {
    const cues = ["first", "then", "for example", "e.g", "step", "because", "tradeoff", "however"];
    const hits = cues.filter((c) => lower.includes(c)).length;
    structure = Math.min(100, 50 + hits * 12);
  }
  if (QUANT.test(text) && structure < 90) structure += 5;
  structure = Math.min(100, structure);

  // Completeness — adequate length, concept coverage, and a concrete outcome.
  let completeness = 0;
  completeness += Math.min(40, Math.round((Math.min(wc, 120) / 120) * 40)); // up to 40 for length
  if (opts.expectedConcepts.length) completeness += Math.round((technical / 100) * 35);
  else completeness += wc >= 60 ? 35 : Math.round((wc / 60) * 35);
  if (QUANT.test(text)) completeness += 15; else feedback.push("Add a concrete, measurable outcome to feel complete.");
  if (/\b(result|outcome|impact|led to|achieved|delivered|resulted)\b/i.test(text)) completeness += 10;
  completeness = Math.min(100, completeness);

  // STAR check for behavioral/project answers.
  const star = opts.kind === "behavioral" || opts.kind === "project" ? checkStar(text) : undefined;

  const overall = Math.round(
    communication * 0.2 + technical * 0.25 + confidence * 0.2 + structure * 0.15 + completeness * 0.2
  );
  if (!feedback.length) feedback.push("Strong, well-structured answer.");
  return { scores: { communication, technical, confidence, structure, completeness, overall }, feedback, wordCount: wc, star };
}

// ---- STAR framework checker (behavioral / project answers) ----
export type StarSection = "situation" | "task" | "action" | "result";
export type StarCheck = {
  situation: boolean;
  task: boolean;
  action: boolean;
  result: boolean;
  present: StarSection[];
  missing: StarSection[];
  score: number;          // 0-100, 25 per section present
  improvement: string;    // one actionable line
};

const STAR_CUES: Record<StarSection, RegExp> = {
  situation: /\b(situation|context|at the time|when i|while working|背景|the project was|we were|our team was|i was working)\b/i,
  task: /\b(task|goal|objective|responsible for|my job was|needed to|asked to|had to|the challenge was|required to)\b/i,
  action: /\b(action|i (built|led|designed|implemented|created|wrote|developed|decided|chose|drove|coordinated|refactored|debugged|profiled|added|fixed|optimized|configured|automated|tested|deployed|migrated|integrated|analyzed|investigated|rebuilt|set up)|so i|i started by|my approach|i took|first i|then i|i then)\b/i,
  result: /\b(result|outcome|impact|as a result|led to|resulted in|achieved|delivered|reduced|increased|improved|grew|saved|cut|boosted|\d+\s*%)\b/i,
};

export function checkStar(answer: string): StarCheck {
  const text = answer.trim();
  const flags = {
    situation: STAR_CUES.situation.test(text),
    task: STAR_CUES.task.test(text),
    action: STAR_CUES.action.test(text),
    result: STAR_CUES.result.test(text),
  };
  const order: StarSection[] = ["situation", "task", "action", "result"];
  const present = order.filter((s) => flags[s]);
  const missing = order.filter((s) => !flags[s]);
  const score = present.length * 25;

  let improvement: string;
  if (!missing.length) improvement = "Complete STAR structure — strong behavioral answer.";
  else if (missing.includes("result")) improvement = "Close with a measurable result (a %, number, or clear outcome).";
  else if (missing.includes("action")) improvement = "Spell out the specific actions YOU took, not just the team's.";
  else if (missing.includes("situation")) improvement = "Open by setting the situation/context in one sentence.";
  else improvement = `Add the missing ${missing.join(" and ")} section${missing.length > 1 ? "s" : ""}.`;

  return { ...flags, present, missing, score, improvement };
}

// ---- Readiness from stored practice sessions ----
export type PracticeSession = {
  kind: QuestionKind;
  communication: number;
  technical: number;
  confidence: number;
  completeness: number;
  overall: number;
  question?: string;
  createdAt?: string;
};

export type InterviewReadiness = {
  technical: number;
  behavioral: number;
  project: number;
  communication: number;
  overall: number;
  sessionCount: number;
  byKind: Record<QuestionKind, { count: number; avg: number }>;
  weakAreas: string[];
  strongAreas: string[];
};

const KIND_LABEL: Record<QuestionKind, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  hr: "HR / Fit",
  project: "Project deep-dive",
};

const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

export function computeReadiness(sessions: PracticeSession[]): InterviewReadiness {
  const kinds: QuestionKind[] = ["technical", "behavioral", "hr", "project"];
  const byKind = Object.fromEntries(
    kinds.map((k) => {
      const rows = sessions.filter((s) => s.kind === k);
      return [k, { count: rows.length, avg: avg(rows.map((r) => r.overall)) }];
    })
  ) as Record<QuestionKind, { count: number; avg: number }>;

  const technical = byKind.technical.avg;
  const behavioral = avg(sessions.filter((s) => s.kind === "behavioral" || s.kind === "hr").map((s) => s.overall));
  const project = byKind.project.avg;
  const communication = avg(sessions.map((s) => s.communication));

  // Overall = weighted average over only the dimensions that have data.
  const dims: { v: number; w: number; has: boolean }[] = [
    { v: technical, w: 0.35, has: byKind.technical.count > 0 },
    { v: behavioral, w: 0.25, has: byKind.behavioral.count + byKind.hr.count > 0 },
    { v: project, w: 0.2, has: byKind.project.count > 0 },
    { v: communication, w: 0.2, has: sessions.length > 0 },
  ];
  const active = dims.filter((d) => d.has);
  const wsum = active.reduce((a, d) => a + d.w, 0) || 1;
  const overall = active.length ? Math.round(active.reduce((a, d) => a + d.v * d.w, 0) / wsum) : 0;

  // Weak / strong areas by question kind (only categories that were practiced).
  const practiced = kinds.filter((k) => byKind[k].count > 0);
  const weakAreas = practiced.filter((k) => byKind[k].avg < 65).sort((a, b) => byKind[a].avg - byKind[b].avg).map((k) => KIND_LABEL[k]);
  const strongAreas = practiced.filter((k) => byKind[k].avg >= 75).sort((a, b) => byKind[b].avg - byKind[a].avg).map((k) => KIND_LABEL[k]);

  return { technical, behavioral, project, communication, overall, sessionCount: sessions.length, byKind, weakAreas, strongAreas };
}
