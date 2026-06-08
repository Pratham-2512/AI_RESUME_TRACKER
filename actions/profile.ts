"use server";

import { revalidatePath } from "next/cache";
import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";
import {
  profileSchema, educationSchema, experienceSchema, skillSchema,
  projectSchema, certificationSchema, careerGoalSchema,
} from "@/lib/domain/validation";
import { buildProfileSummary } from "@/lib/rag/profileSummary";
import { embed } from "@/lib/ai/embeddings";

function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== "" && v !== undefined)
  ) as T;
}

export async function updateProfile(input: unknown) {
  const db = createDb();
  const data = profileSchema.parse(input);
  const { error } = await db.from("profiles").update(clean(data)).eq("id", OWNER_ID);
  if (error) throw new Error(error.message);
  revalidatePath("/app/profile");
}

type Table = "education" | "experience" | "skills" | "projects" | "certifications" | "career_goals";

async function addRow(table: Table, schema: { parse: (v: unknown) => object }, input: unknown) {
  const db = createDb();
  const data = clean(schema.parse(input) as Record<string, unknown>);
  const { error } = await db.from(table).insert(data as never);
  if (error) throw new Error(error.message);
  revalidatePath("/app/profile");
}

async function deleteRow(table: Table, id: string) {
  const db = createDb();
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/profile");
}

export async function addEducation(i: unknown) { return addRow("education", educationSchema, i); }
export async function addExperience(i: unknown) { return addRow("experience", experienceSchema, i); }
export async function addSkill(i: unknown) { return addRow("skills", skillSchema, i); }
export async function addProject(i: unknown) { return addRow("projects", projectSchema, i); }
export async function addCertification(i: unknown) { return addRow("certifications", certificationSchema, i); }
export async function addCareerGoal(i: unknown) { return addRow("career_goals", careerGoalSchema, i); }

export async function deleteEducation(id: string) { return deleteRow("education", id); }
export async function deleteExperience(id: string) { return deleteRow("experience", id); }
export async function deleteSkill(id: string) { return deleteRow("skills", id); }
export async function deleteProject(id: string) { return deleteRow("projects", id); }
export async function deleteCertification(id: string) { return deleteRow("certifications", id); }
export async function deleteCareerGoal(id: string) { return deleteRow("career_goals", id); }

/** Rebuild the singleton profile embedding from current profile + skills + experience. */
export async function reembedProfile() {
  const db = createDb();
  const [{ data: profile }, { data: skills }, { data: experience }] = await Promise.all([
    db.from("profiles").select("headline,summary,target_roles,years_experience,location").eq("id", OWNER_ID).single(),
    db.from("skills").select("name,proficiency,years"),
    db.from("experience").select("title,company").order("sort_order"),
  ]);
  if (!profile) return;

  const summary = buildProfileSummary({ profile, skills: skills ?? [], experience: experience ?? [] });
  if (!summary.trim()) return;

  try {
    const vector = await embed(summary);
    await db.from("profiles").update({ embedding: JSON.stringify(vector) }).eq("id", OWNER_ID);
  } catch (e) {
    console.error("[reembedProfile] embedding failed:", e);
  }
}
