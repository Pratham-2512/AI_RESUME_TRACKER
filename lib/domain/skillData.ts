/**
 * Static skill metadata — difficulty to learn, baseline market demand, category,
 * and a concrete first learning step. Deterministic, no LLM. Demand is a 0-100
 * baseline that the career engine blends with live demand counted from the
 * user's own opportunity pool.
 */
export type LearnDifficulty = "easy" | "medium" | "hard";

export type SkillMeta = {
  difficulty: LearnDifficulty;
  /** baseline market demand 0-100 */
  demand: number;
  category: string;
  /** concrete first move when learning this skill */
  learn: string;
};

export const SKILL_META: Record<string, SkillMeta> = {
  Python: { difficulty: "easy", demand: 95, category: "Language", learn: "Work through Python basics, then build a small CLI tool." },
  JavaScript: { difficulty: "easy", demand: 92, category: "Language", learn: "Learn ES6+ syntax and the DOM, then build an interactive page." },
  TypeScript: { difficulty: "medium", demand: 85, category: "Language", learn: "Add types to an existing JS project; learn generics and unions." },
  Java: { difficulty: "medium", demand: 78, category: "Language", learn: "Build a small OOP project; learn collections and streams." },
  Go: { difficulty: "medium", demand: 70, category: "Language", learn: "Build a concurrent CLI; learn goroutines and channels." },
  "C++": { difficulty: "hard", demand: 60, category: "Language", learn: "Learn memory/pointers; implement classic data structures." },
  SQL: { difficulty: "easy", demand: 90, category: "Data", learn: "Practice JOINs, GROUP BY, and indexing on a real dataset." },
  React: { difficulty: "medium", demand: 88, category: "Frontend", learn: "Build a component-driven app with hooks and state." },
  "Next.js": { difficulty: "medium", demand: 80, category: "Frontend", learn: "Ship an app-router project with server components." },
  "Node.js": { difficulty: "medium", demand: 82, category: "Backend", learn: "Build a REST API with Express and a database." },
  Vue: { difficulty: "medium", demand: 55, category: "Frontend", learn: "Build a single-page app with the Composition API." },
  Angular: { difficulty: "hard", demand: 50, category: "Frontend", learn: "Build a typed app with services and RxJS." },
  Tailwind: { difficulty: "easy", demand: 65, category: "Frontend", learn: "Restyle a page using utility classes and responsive variants." },
  Django: { difficulty: "medium", demand: 62, category: "Backend", learn: "Build a CRUD app with the ORM and admin." },
  Flask: { difficulty: "easy", demand: 58, category: "Backend", learn: "Build a small JSON API with blueprints." },
  FastAPI: { difficulty: "medium", demand: 72, category: "Backend", learn: "Build a typed async API with Pydantic models." },
  Express: { difficulty: "easy", demand: 68, category: "Backend", learn: "Build a routed API with middleware and error handling." },
  PostgreSQL: { difficulty: "medium", demand: 80, category: "Data", learn: "Design a normalized schema; practice EXPLAIN and indexes." },
  MySQL: { difficulty: "easy", demand: 70, category: "Data", learn: "Model relations and write aggregate queries." },
  MongoDB: { difficulty: "easy", demand: 62, category: "Data", learn: "Model documents; practice aggregation pipelines." },
  Redis: { difficulty: "medium", demand: 64, category: "Data", learn: "Use it as a cache and for rate-limiting." },
  Docker: { difficulty: "medium", demand: 85, category: "DevOps", learn: "Containerize an app; write a multi-stage Dockerfile." },
  Kubernetes: { difficulty: "hard", demand: 78, category: "DevOps", learn: "Deploy a service with Deployments and Services on minikube." },
  AWS: { difficulty: "hard", demand: 88, category: "Cloud", learn: "Deploy an app on EC2/S3/Lambda; learn IAM basics." },
  GCP: { difficulty: "hard", demand: 70, category: "Cloud", learn: "Deploy to Cloud Run; learn IAM and buckets." },
  Azure: { difficulty: "hard", demand: 68, category: "Cloud", learn: "Deploy an app service; learn resource groups." },
  Terraform: { difficulty: "medium", demand: 66, category: "DevOps", learn: "Provision cloud infra declaratively from scratch." },
  "CI/CD": { difficulty: "medium", demand: 75, category: "DevOps", learn: "Add a GitHub Actions pipeline that tests and deploys." },
  Pandas: { difficulty: "easy", demand: 82, category: "Data Science", learn: "Clean and analyze a CSV dataset end-to-end." },
  NumPy: { difficulty: "easy", demand: 72, category: "Data Science", learn: "Practice array ops and vectorization." },
  "scikit-learn": { difficulty: "medium", demand: 78, category: "ML", learn: "Train and evaluate a classifier on a real dataset." },
  PyTorch: { difficulty: "hard", demand: 84, category: "ML", learn: "Build and train a neural net; learn autograd." },
  TensorFlow: { difficulty: "hard", demand: 74, category: "ML", learn: "Train a model with Keras; learn the data pipeline." },
  Keras: { difficulty: "medium", demand: 60, category: "ML", learn: "Build a sequential model and tune it." },
  LLM: { difficulty: "medium", demand: 90, category: "AI", learn: "Build an app on an LLM API; learn prompting and tool use." },
  NLP: { difficulty: "hard", demand: 78, category: "AI", learn: "Build a text classifier; learn embeddings and tokenization." },
  "Computer Vision": { difficulty: "hard", demand: 68, category: "AI", learn: "Build an image classifier with a CNN." },
  "Machine Learning": { difficulty: "hard", demand: 85, category: "ML", learn: "Learn the train/validate/test loop on a real problem." },
  "Deep Learning": { difficulty: "hard", demand: 80, category: "ML", learn: "Train a deep net; learn backprop and regularization." },
  "Data Analysis": { difficulty: "easy", demand: 80, category: "Data Science", learn: "Tell a story from a dataset with charts and stats." },
  Tableau: { difficulty: "easy", demand: 64, category: "Analytics", learn: "Build an interactive dashboard from a dataset." },
  "Power BI": { difficulty: "easy", demand: 66, category: "Analytics", learn: "Build a report with DAX measures." },
  Excel: { difficulty: "easy", demand: 70, category: "Analytics", learn: "Master pivot tables, lookups, and charts." },
  Statistics: { difficulty: "medium", demand: 76, category: "Data Science", learn: "Learn distributions, hypothesis testing, and regression." },
  "A/B Testing": { difficulty: "medium", demand: 62, category: "Analytics", learn: "Design an experiment; learn significance and power." },
  Spark: { difficulty: "hard", demand: 68, category: "Data Engineering", learn: "Process a large dataset with DataFrames." },
  Airflow: { difficulty: "medium", demand: 60, category: "Data Engineering", learn: "Author a DAG that orchestrates a pipeline." },
  Kafka: { difficulty: "hard", demand: 64, category: "Data Engineering", learn: "Build a producer/consumer; learn topics and partitions." },
  ETL: { difficulty: "medium", demand: 70, category: "Data Engineering", learn: "Build an extract-transform-load pipeline." },
  Snowflake: { difficulty: "medium", demand: 66, category: "Data", learn: "Load data and write analytical queries." },
  GraphQL: { difficulty: "medium", demand: 60, category: "Backend", learn: "Build a typed schema with resolvers." },
  REST: { difficulty: "easy", demand: 80, category: "Backend", learn: "Design resource-oriented endpoints with proper status codes." },
  Git: { difficulty: "easy", demand: 90, category: "Tooling", learn: "Practice branching, rebasing, and resolving conflicts." },
  Linux: { difficulty: "medium", demand: 72, category: "Tooling", learn: "Get comfortable with the shell, permissions, and processes." },
  "System Design": { difficulty: "hard", demand: 82, category: "Architecture", learn: "Practice designing scalable systems; learn tradeoffs." },
  Microservices: { difficulty: "hard", demand: 70, category: "Architecture", learn: "Split a monolith; learn service boundaries and messaging." },
  RAG: { difficulty: "medium", demand: 82, category: "AI", learn: "Build a retrieval-augmented chatbot over your own docs." },
  "Vector DB": { difficulty: "medium", demand: 74, category: "AI", learn: "Index embeddings and run similarity search." },
  HTML: { difficulty: "easy", demand: 60, category: "Frontend", learn: "Build semantic, accessible markup." },
  CSS: { difficulty: "easy", demand: 62, category: "Frontend", learn: "Master flexbox, grid, and responsive layout." },
};

/** Role → the skills that define it (used for target-role gap analysis). */
export const ROLE_SKILLS: Record<string, string[]> = {
  ai_engineer: ["Python", "LLM", "RAG", "PyTorch", "NLP", "Vector DB", "Docker", "AWS"],
  ml_engineer: ["Python", "Machine Learning", "PyTorch", "TensorFlow", "Deep Learning", "scikit-learn", "Docker", "AWS"],
  data_scientist: ["Python", "Statistics", "Machine Learning", "Pandas", "SQL", "Data Analysis", "scikit-learn"],
  data_analyst: ["SQL", "Data Analysis", "Tableau", "Power BI", "Excel", "Statistics", "Python"],
  python_developer: ["Python", "Django", "Flask", "FastAPI", "SQL", "REST", "Git", "Docker"],
  full_stack: ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "REST", "Git", "Next.js"],
  software_developer: ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Git", "REST", "System Design"],
  data_engineer: ["Python", "SQL", "Spark", "Airflow", "ETL", "Kafka", "AWS", "Snowflake"],
};

export const ROLE_LABELS: Record<string, string> = {
  ai_engineer: "AI Engineer",
  ml_engineer: "ML Engineer",
  data_scientist: "Data Scientist",
  data_analyst: "Data Analyst",
  python_developer: "Python Developer",
  full_stack: "Full-Stack Developer",
  software_developer: "Software Developer",
  data_engineer: "Data Engineer",
  generic: "General",
  ats: "ATS-Optimized",
};

const DEFAULT_META: SkillMeta = { difficulty: "medium", demand: 50, category: "General", learn: "Find a focused course and build one small project." };

export function skillMeta(skill: string): SkillMeta {
  return SKILL_META[skill] ?? DEFAULT_META;
}

/** Resolve the canonical skill list for a target role. Falls back to a broad set. */
export function roleSkills(role: string | null | undefined): string[] {
  if (role && ROLE_SKILLS[role]) return ROLE_SKILLS[role];
  return ROLE_SKILLS.full_stack;
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "your target role";
  return ROLE_LABELS[role] ?? role;
}
