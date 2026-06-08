import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";
import { ProfileEditor } from "@/components/profile/profile-editor";

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
  const db = createDb();
  let profile: ProfileShape = EMPTY;
  let skills: { id: string; name: string; category: string | null; proficiency: number | null; years: number | null }[] = [];
  let experience: { id: string; company: string; title: string; start_date: string | null; end_date: string | null; is_current: boolean | null; description: string | null }[] = [];
  let dbError: string | null = null;

  try {
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
    <div>
      <h1 className="text-2xl font-bold">Profile</h1>
      <p className="mt-1 text-muted-foreground">
        Your career foundation. Every AI feature uses this — keep it current.
      </p>
      {dbError && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Database not ready: {dbError}. Apply the schema (see SUPABASE_SETUP.md).
        </div>
      )}
      <div className="mt-6">
        <ProfileEditor profile={profile} skills={skills} experience={experience} />
      </div>
    </div>
  );
}
