/**
 * Match Explanation v2 — decomposes a stored job match into star-rated
 * dimensions. Pure and client-safe: derives everything from fields already
 * persisted on the opportunity, no LLM and no DB access.
 */

const AI_SKILLS = new Set([
  "llm", "rag", "nlp", "pytorch", "tensorflow", "keras", "scikit-learn",
  "machine learning", "deep learning", "computer vision", "vector db",
]);

export type MatchDimension = {
  key: string;
  label: string;
  stars: number; // 0–5
  detail: string;
};

export type MatchExplanation = {
  dimensions: MatchDimension[];
  recommendation: { label: string; tone: "strong" | "good" | "stretch" | "skip"; action: string };
};

function starsFromCoverage(matched: number, required: number): number {
  if (required === 0) return 3;
  return Math.max(0, Math.min(5, Math.round((matched / required) * 5)));
}

export function explainMatch(input: {
  title: string;
  matchScore: number | null;
  requiredSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  yearsRequired: number | null;
  candidateYears: number | null;
  targetRoles: string[];
}): MatchExplanation {
  const dimensions: MatchDimension[] = [];
  const req = input.requiredSkills;
  const matched = input.matchedSkills;

  // Technical skills — coverage of everything the JD asks for
  dimensions.push({
    key: "technical",
    label: "Technical Skills",
    stars: starsFromCoverage(matched.length, req.length),
    detail: req.length
      ? `${matched.length} of ${req.length} required skills`
      : "No recognizable stack in the JD",
  });

  // AI stack — only shown when the JD asks for AI skills
  const aiRequired = req.filter((s) => AI_SKILLS.has(s.toLowerCase()));
  if (aiRequired.length) {
    const aiMatched = aiRequired.filter((s) =>
      matched.some((m) => m.toLowerCase() === s.toLowerCase()),
    );
    dimensions.push({
      key: "ai",
      label: "AI Stack",
      stars: starsFromCoverage(aiMatched.length, aiRequired.length),
      detail: `${aiMatched.length} of ${aiRequired.length} AI skills (${aiRequired.join(", ")})`,
    });
  }

  // Experience — candidate years vs. the JD's ask
  if (input.yearsRequired == null) {
    dimensions.push({ key: "experience", label: "Experience", stars: 4, detail: "No explicit years requirement" });
  } else if (input.candidateYears == null) {
    dimensions.push({ key: "experience", label: "Experience", stars: 3, detail: `Asks for ${input.yearsRequired}y — set your experience in Profile` });
  } else {
    const gap = input.candidateYears - input.yearsRequired;
    const stars = gap >= 0 ? 5 : gap >= -1 ? 4 : gap >= -2 ? 3 : gap >= -4 ? 2 : 1;
    dimensions.push({
      key: "experience",
      label: "Experience",
      stars,
      detail: `They ask ${input.yearsRequired}y · you have ${input.candidateYears}y${gap < 0 ? " — counter with depth and shipped work" : ""}`,
    });
  }

  // Role fit — does the title overlap the roles you're targeting?
  const title = input.title.toLowerCase();
  const targetWords = new Set(
    input.targetRoles.flatMap((r) => r.toLowerCase().split(/\s+/)).filter((w) => w.length > 2),
  );
  const titleWords = title.split(/[^a-z+#.]+/).filter((w) => w.length > 2);
  const overlap = titleWords.filter((w) => targetWords.has(w)).length;
  const roleStars = overlap >= 2 ? 5 : overlap === 1 ? 3 : 1;
  dimensions.push({
    key: "role",
    label: "Role Fit",
    stars: input.targetRoles.length ? roleStars : 3,
    detail: input.targetRoles.length
      ? roleStars >= 5 ? "Squarely in your target roles"
        : roleStars >= 3 ? "Adjacent to your target roles"
        : "Outside your stated targets"
      : "Set target roles in Profile for role-fit scoring",
  });

  // Recommendation
  const score = input.matchScore ?? 0;
  const topGaps = input.missingSkills.slice(0, 2).join(", ");
  const recommendation =
    score >= 75
      ? { label: "Strong Match", tone: "strong" as const, action: "Apply now with your primary resume." }
      : score >= 55
        ? { label: "Good Match", tone: "good" as const, action: `Apply — address ${topGaps || "the gaps"} in your cover letter.` }
        : score >= 35
          ? { label: "Stretch", tone: "stretch" as const, action: `Apply only if you can credibly cover ${topGaps || "the missing skills"}.` }
          : { label: "Weak Match", tone: "skip" as const, action: "Your time is better spent on stronger matches." };

  return { dimensions, recommendation };
}
