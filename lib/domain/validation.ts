import { z } from "zod";

const optStr = z.string().trim().max(2000).optional().or(z.literal(""));
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));

export const profileSchema = z.object({
  full_name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  location: z.string().trim().max(200).optional(),
  headline: z.string().trim().max(300).optional(),
  summary: z.string().trim().max(4000).optional(),
  career_goals: z.string().trim().max(2000).optional(),
  target_roles: z.array(z.string().trim().max(120)).max(20).optional(),
  years_experience: z.coerce.number().min(0).max(60).optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const educationSchema = z.object({
  school: z.string().trim().min(1).max(200),
  degree: optStr, field: optStr, grade: optStr,
  start_date: dateStr, end_date: dateStr,
  is_current: z.boolean().optional(), description: optStr,
});

export const experienceSchema = z.object({
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  location: optStr,
  employment_type: z.enum(["full_time", "internship", "contract", "part_time"]).optional(),
  start_date: dateStr, end_date: dateStr,
  is_current: z.boolean().optional(), description: optStr,
  highlights: z.array(z.string().trim().max(500)).max(15).optional(),
});

export const skillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(["language", "framework", "tool", "cloud", "soft", "domain"]).optional(),
  proficiency: z.coerce.number().int().min(1).max(5).optional(),
  years: z.coerce.number().min(0).max(50).optional(),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: optStr,
  tech_stack: z.array(z.string().trim().max(60)).max(30).optional(),
  url: optStr, repo_url: optStr,
  highlights: z.array(z.string().trim().max(500)).max(15).optional(),
});

export const certificationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  issuer: optStr, issued_date: dateStr, expiry_date: dateStr, credential_url: optStr,
});

export const careerGoalSchema = z.object({
  goal: z.string().trim().min(1).max(500),
  target_role: optStr,
  target_salary: z.coerce.number().int().min(0).optional(),
  horizon_months: z.coerce.number().int().min(1).max(120).optional(),
});

export const resumeTargetSchema = z.enum([
  "ats", "ai_engineer", "data_analyst", "software_developer", "ml_engineer",
  "data_scientist", "python_developer", "full_stack", "generic",
]);
