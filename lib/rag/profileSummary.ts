import type { Database } from "@/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Skill = Database["public"]["Tables"]["skills"]["Row"];
type Experience = Database["public"]["Tables"]["experience"]["Row"];

/**
 * Deterministic profile summary used as the embedding query for job matching
 * and as compact context for AI features. No LLM call — keeps it cheap + stable.
 */
export function buildProfileSummary(input: {
  profile: Pick<Profile, "headline" | "summary" | "target_roles" | "years_experience" | "location">;
  skills: Pick<Skill, "name" | "proficiency" | "years">[];
  experience: Pick<Experience, "title" | "company">[];
}): string {
  const { profile, skills, experience } = input;

  const topSkills = [...skills]
    .sort((a, b) => (b.proficiency ?? 0) - (a.proficiency ?? 0) || (b.years ?? 0) - (a.years ?? 0))
    .slice(0, 20)
    .map((s) => s.name)
    .join(", ");

  const roles = (profile.target_roles ?? []).join(", ");
  const recent = experience.slice(0, 4).map((e) => `${e.title} at ${e.company}`).join("; ");

  const parts = [
    profile.headline && `Headline: ${profile.headline}`,
    roles && `Target roles: ${roles}`,
    profile.years_experience != null && `Experience: ${profile.years_experience} years`,
    profile.location && `Location: ${profile.location}`,
    topSkills && `Top skills: ${topSkills}`,
    recent && `Recent roles: ${recent}`,
    profile.summary && `Summary: ${profile.summary}`,
  ].filter(Boolean);

  return parts.join("\n");
}
