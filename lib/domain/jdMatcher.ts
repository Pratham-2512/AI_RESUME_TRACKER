// Deterministic JD ↔ resume keyword matcher — no API key required.

const KNOWN_SKILLS: string[] = [
  // Languages
  "python","javascript","typescript","java","c++","c#","go","golang","rust","ruby","php",
  "swift","kotlin","scala","r","matlab","bash","shell","perl","lua","haskell","elixir",
  // Frontend
  "react","vue","angular","next.js","nextjs","gatsby","svelte","html","css","tailwind",
  "sass","scss","webpack","vite","redux","graphql","restful","rest api",
  // Backend
  "node.js","nodejs","express","django","flask","fastapi","spring","rails","laravel",
  "nestjs","asp.net","gin","fiber",
  // Mobile
  "react native","flutter","ios","android","xamarin",
  // Databases
  "sql","postgresql","mysql","sqlite","mongodb","redis","elasticsearch","cassandra",
  "dynamodb","neo4j","oracle","snowflake","bigquery","supabase","firebase",
  // Cloud / Infra
  "aws","azure","gcp","google cloud","heroku","vercel","netlify","cloudflare",
  "docker","kubernetes","terraform","ansible","jenkins","github actions","ci/cd",
  "devops","helm","prometheus","grafana","nginx","linux",
  // AI / ML
  "pytorch","tensorflow","scikit-learn","keras","nlp","llm","rag","langchain",
  "machine learning","deep learning","neural networks","computer vision","huggingface",
  "openai","anthropic","vector database","embedding","transformers","bert","gpt",
  // Data
  "pandas","numpy","spark","hadoop","kafka","airflow","dbt","tableau","power bi",
  "looker","matplotlib","seaborn","excel","etl","data pipeline","data warehouse",
  // Tools & practices
  "git","github","gitlab","jira","confluence","figma","postman","swagger",
  "agile","scrum","kanban","microservices","system design","tdd","bdd",
  "api design","oauth","jwt","graphql","grpc","websocket",
  // Soft skills
  "communication","leadership","collaboration","problem solving","analytical thinking",
  "teamwork","stakeholder management","project management","product management",
  "critical thinking","attention to detail","time management",
];

// For target detection
const ROLE_SIGNALS: Record<string, string[]> = {
  ai_engineer:        ["llm","rag","pytorch","nlp","embedding","vector","openai","anthropic","langchain","huggingface"],
  ml_engineer:        ["machine learning","pytorch","tensorflow","scikit-learn","deep learning","model training","mlops"],
  data_scientist:     ["statistics","regression","pandas","jupyter","matplotlib","hypothesis","data analysis","r"],
  data_analyst:       ["sql","tableau","power bi","excel","dashboard","reporting","data analysis","looker"],
  python_developer:   ["python","django","flask","fastapi","celery","asyncio","pydantic"],
  full_stack:         ["react","node.js","javascript","frontend","backend","api","nextjs","vue","angular"],
  software_developer: ["software development","algorithms","system design","object-oriented","microservices","ci/cd"],
};

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by","from",
  "is","are","was","were","be","been","have","has","had","do","does","did","will",
  "would","shall","should","may","might","must","can","could","as","that","this",
  "these","those","it","its","we","our","you","your","they","their","who","which",
  "when","where","what","how","all","each","every","any","some","not","if","so",
  "also","than","then","there","here","into","about","through","during","including",
  "over","under","after","before","within","without","above","below","since","until",
  "up","down","out","off","per","via","both","either","experience","work","years",
  "year","team","using","use","new","able","good","strong","well","great","excellent",
  "required","preferred","plus","including","able","ensure","position","role","job",
  "candidate","responsible","responsibilities","qualifications","requirements",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9.#+\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function extractKeywords(text: string): string[] {
  const lower = normalize(text);
  const found = new Set<string>();

  // Multi-word skills first (longer phrases take priority)
  const sorted = [...KNOWN_SKILLS].sort((a, b) => b.length - a.length);
  for (const skill of sorted) {
    if (lower.includes(normalize(skill))) {
      found.add(skill);
    }
  }

  // Single meaningful words not yet covered
  const words = lower.split(/\s+/);
  for (const word of words) {
    const w = word.replace(/[^a-z0-9#+.]/g, "");
    if (w.length >= 3 && !STOP_WORDS.has(w) && !found.has(w)) {
      // Include capitalized-origin words (proper nouns / acronyms)
      const original = text.split(/\s+/).find((t) => t.toLowerCase().replace(/[^a-z0-9]/g, "") === w.replace(/[^a-z0-9]/g, ""));
      if (original && /^[A-Z]/.test(original) && original.length >= 2) {
        found.add(original.toLowerCase().replace(/[^a-z0-9+#.]/g, ""));
      }
    }
  }

  return [...found].slice(0, 50);
}

export function detectTarget(jdText: string): string {
  const lower = jdText.toLowerCase();
  const scores: Record<string, number> = {};
  for (const [role, signals] of Object.entries(ROLE_SIGNALS)) {
    scores[role] = signals.filter((s) => lower.includes(s)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : "ats";
}

export function extractJobTitle(jdText: string): string {
  const lines = jdText.split("\n").map((l) => l.trim()).filter(Boolean);
  // Try first non-empty line that looks like a job title
  for (const line of lines.slice(0, 5)) {
    if (line.length < 80 && !/^(company|about|location|salary|responsibilities|requirements)/i.test(line)) {
      return line.replace(/[^a-zA-Z0-9 \-/]/g, "").trim();
    }
  }
  return "Software Engineer";
}

export interface MatchResult {
  matchPercent: number;
  jdKeywords: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestedTarget: string;
  jobTitle: string;
  linkedInSearchUrl: string;
}

export function matchResumeToJD(resumeText: string, jdText: string): MatchResult {
  const jdKeywords = extractKeywords(jdText);
  const resumeKeywords = extractKeywords(resumeText);
  const resumeLower = normalize(resumeText);

  const matchedKeywords = jdKeywords.filter(
    (k) => resumeLower.includes(normalize(k)) || resumeKeywords.includes(k)
  );
  const missingKeywords = jdKeywords.filter((k) => !matchedKeywords.includes(k));
  const matchPercent = jdKeywords.length > 0
    ? Math.round((matchedKeywords.length / jdKeywords.length) * 100)
    : 0;

  const suggestedTarget = detectTarget(jdText);
  const jobTitle = extractJobTitle(jdText);

  // Top 3 missing skills for LinkedIn search
  const searchTerms = [jobTitle, ...matchedKeywords.slice(0, 2)].join(" ");
  const linkedInSearchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(searchTerms)}&f_LF=f_AL`;

  return { matchPercent, jdKeywords, matchedKeywords, missingKeywords, suggestedTarget, jobTitle, linkedInSearchUrl };
}
