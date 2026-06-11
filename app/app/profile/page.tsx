import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { PageHeader, ErrorBanner } from "@/components/shared/ui";

export const dynamic = "force-dynamic";

type ProfileShape = {
  full_name: string | null; phone: string | null; location: string | null;
  headline: string | null; summary: string | null; career_goals: string | null;
  target_roles: string[] | null; years_experience: number | null;
};

const EMPTY: ProfileShape = {
  full_name: null, phone: null, location: null, headline: null,
  summary: null, career_goals: null, target_roles: [], years_experience: null,
};

export default async function ProfilePage() {
  let profile: ProfileShape = EMPTY;
  let skills: { id: string; name: string; category: string | null; proficiency: number | null; years: number | null }[] = [];
  let experience: { id: string; company: string; title: string; start_date: string | null; end_date: string | null; is_current: boolean | null; description: string | null }[] = [];
  let dbError: string | null = null;

  try {
    const db = createDb();
    const [p, s, x] = await Promise.all([
      db.from("profiles").select("full_name,phone,location,headline,summary,career_goals,target_roles,years_experience").eq("id", OWNER_ID).maybeSingle(),
      db.from("skills").select("id,name,category,proficiency,years").order("created_at"),
      db.from("experience").select("id,company,title,start_date,end_date,is_current,description").order("start_date", { ascending: false }),
    ]);
    profile = p.data ?? EMPTY;
    skills = s.data ?? [];
    experience = x.data ?? [];
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Database not reachable";
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Profile"
        desc="Your career foundation. Every AI feature uses this — keep it current."
      />
      {dbError && (
        <ErrorBanner>Database not ready: {dbError}. Apply the schema (see SUPABASE_SETUP.md).</ErrorBanner>
      )}
      <ProfileEditor profile={profile} skills={skills} experience={experience} />
    </div>
  );
}
