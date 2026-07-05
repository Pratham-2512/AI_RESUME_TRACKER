/**
 * Hand-authored DB types — canonical single-user schema.
 * Regenerate after schema changes:
 *   supabase gen types typescript --linked > lib/supabase/database.types.ts
 */
export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type JobType = "full_time" | "internship" | "contract" | "part_time";
export type WorkMode = "remote" | "hybrid" | "onsite";
export type AppStatus =
  | "saved" | "applied" | "assessment" | "interview" | "final_round" | "offer" | "rejected" | "ghosted";
export type ResumeTarget =
  | "ats" | "ai_engineer" | "data_analyst" | "software_developer" | "ml_engineer"
  | "data_scientist" | "python_developer" | "full_stack" | "generic";
export type JobSourceKind = "greenhouse" | "lever" | "remotive";
export type DocType =
  | "cover_letter" | "recruiter_message" | "hiring_manager_email" | "followup_email" | "thank_you_email"
  | "linkedin_headline" | "linkedin_about" | "linkedin_post" | "linkedin_project_post" | "linkedin_connect";

type Rel = [];
type Ts = { created_at: string };
type T<Row, Ins, Upd> = { Row: Row; Insert: Ins; Update: Upd; Relationships: Rel };
type P<Row> = Partial<Row>;

type ProfileRow = {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  location: string | null; headline: string | null; summary: string | null;
  career_goals: string | null; target_roles: string[] | null; years_experience: number | null;
  profile_version: number; embedding: string | null; singleton: boolean;
  linkedin_access_token: string | null; linkedin_token_expiry: string | null; linkedin_sub: string | null;
  created_at: string; updated_at: string;
};
type EducationRow = Ts & { id: string; school: string; degree: string | null; field: string | null; grade: string | null; start_date: string | null; end_date: string | null; is_current: boolean | null; description: string | null; sort_order: number | null };
type ExperienceRow = Ts & { id: string; company: string; title: string; location: string | null; employment_type: JobType | null; start_date: string | null; end_date: string | null; is_current: boolean | null; description: string | null; highlights: string[] | null; sort_order: number | null };
type SkillRow = Ts & { id: string; name: string; category: string | null; proficiency: number | null; years: number | null };
type CertRow = Ts & { id: string; name: string; issuer: string | null; issued_date: string | null; expiry_date: string | null; credential_url: string | null };
type ProjectRow = Ts & { id: string; name: string; description: string | null; tech_stack: string[] | null; url: string | null; repo_url: string | null; highlights: string[] | null; sort_order: number | null };
type GoalRow = Ts & { id: string; goal: string; target_role: string | null; target_salary: number | null; horizon_months: number | null; status: string | null };
type ResumeRow = { id: string; label: string | null; storage_path: string | null; source: string | null; target: ResumeTarget | null; parsed_text: string | null; parsed_json: Json | null; status: string | null; is_primary: boolean | null; created_at: string; updated_at: string };
type ResumeVersionRow = Ts & { id: string; resume_id: string; version_no: number; target: ResumeTarget; content_md: string | null; content_json: Json | null; ats_score: number | null; created_by_ai: boolean | null };
type ResumeAnalysisRow = Ts & { id: string; resume_id: string; opportunity_id: string | null; before_score: number | null; after_score: number | null; ats_breakdown: Json | null; matched_keywords: string[] | null; missing_keywords: string[] | null; missing_skills: string[] | null; weak_sections: Json | null; suggestions: Json | null; model: string | null };
type OpportunityRow = {
  id: string; source: string | null; url: string | null; title: string; company: string | null; location: string | null;
  work_mode: WorkMode | null; job_type: JobType | null; job_text: string | null;
  required_skills: string[] | null; years_required: number | null; match_score: number | null;
  interview_prob_label: string | null; interview_prob_pct: number | null;
  matched_skills: string[] | null; missing_skills: string[] | null; strengths: string[] | null; weaknesses: string[] | null;
  strategy: string | null; recommended_resume: ResumeTarget | null; model: string | null;
  status: AppStatus; embedding: string | null;
  external_id: string | null; source_id: string | null; apply_url: string | null;
  salary_text: string | null; posted_at: string | null; dismissed_at: string | null; starred: boolean;
  created_at: string; updated_at: string;
};
type JobSourceRow = Ts & {
  id: string; kind: JobSourceKind; board: string; label: string | null; active: boolean;
  last_run_at: string | null; last_status: string | null; last_count: number | null;
};
type ApplicationRow = { id: string; opportunity_id: string | null; job_title: string | null; company: string | null; status: AppStatus; applied_at: string | null; followup_date: string | null; resume_version_id: string | null; notes: string | null; source: string | null; created_at: string; updated_at: string };
type AppEventRow = Ts & { id: string; application_id: string; from_status: AppStatus | null; to_status: AppStatus; note: string | null };
type GeneratedDocRow = Ts & { id: string; opportunity_id: string | null; resume_id: string | null; type: DocType; title: string | null; content: string; tone: string | null; model: string | null };
type InterviewKitRow = Ts & { id: string; opportunity_id: string | null; title: string | null; model: string | null };
type InterviewQuestionRow = Ts & { id: string; kit_id: string; kind: string; difficulty: string | null; question: string; suggested_answer: string | null; confidence: number | null; sort_order: number | null };
type SkillGapRow = Ts & { id: string; scope: string | null; most_requested: Json | null; missing_frequency: Json | null; market_trends: Json | null; model: string | null };
type LearningRoadmapRow = Ts & { id: string; report_id: string | null; title: string | null; weeks: Json | null };
type CoachingSessionRow = { id: string; title: string | null; created_at: string; updated_at: string };
type CoachingMessageRow = Ts & { id: string; session_id: string; role: string; content: string; tokens_in: number | null; tokens_out: number | null };
type AnalyticsEventRow = Ts & { id: string; type: string; feature: string | null; model: string | null; tokens_in: number | null; tokens_out: number | null; cost_usd: number | null; latency_ms: number | null; props: Json | null };

export interface Database {
  public: {
    Tables: {
      profiles: T<ProfileRow, P<ProfileRow>, P<ProfileRow>>;
      education: T<EducationRow, { school: string } & P<EducationRow>, P<EducationRow>>;
      experience: T<ExperienceRow, { company: string; title: string } & P<ExperienceRow>, P<ExperienceRow>>;
      skills: T<SkillRow, { name: string } & P<SkillRow>, P<SkillRow>>;
      certifications: T<CertRow, { name: string } & P<CertRow>, P<CertRow>>;
      projects: T<ProjectRow, { name: string } & P<ProjectRow>, P<ProjectRow>>;
      career_goals: T<GoalRow, { goal: string } & P<GoalRow>, P<GoalRow>>;
      resumes: T<ResumeRow, P<ResumeRow>, P<ResumeRow>>;
      resume_versions: T<ResumeVersionRow, { resume_id: string; version_no: number } & P<ResumeVersionRow>, P<ResumeVersionRow>>;
      resume_analyses: T<ResumeAnalysisRow, { resume_id: string } & P<ResumeAnalysisRow>, P<ResumeAnalysisRow>>;
      opportunities: T<OpportunityRow, { title: string } & P<OpportunityRow>, P<OpportunityRow>>;
      job_sources: T<JobSourceRow, { kind: JobSourceKind; board: string } & P<JobSourceRow>, P<JobSourceRow>>;
      applications: T<ApplicationRow, { status?: AppStatus } & P<ApplicationRow>, P<ApplicationRow>>;
      application_events: T<AppEventRow, { application_id: string; to_status: AppStatus } & P<AppEventRow>, P<AppEventRow>>;
      generated_documents: T<GeneratedDocRow, { type: DocType; content: string } & P<GeneratedDocRow>, P<GeneratedDocRow>>;
      interview_kits: T<InterviewKitRow, P<InterviewKitRow>, P<InterviewKitRow>>;
      interview_questions: T<InterviewQuestionRow, { kit_id: string; kind: string; question: string } & P<InterviewQuestionRow>, P<InterviewQuestionRow>>;
      skill_gap_reports: T<SkillGapRow, P<SkillGapRow>, P<SkillGapRow>>;
      learning_roadmaps: T<LearningRoadmapRow, P<LearningRoadmapRow>, P<LearningRoadmapRow>>;
      coaching_sessions: T<CoachingSessionRow, P<CoachingSessionRow>, P<CoachingSessionRow>>;
      coaching_messages: T<CoachingMessageRow, { session_id: string; role: string; content: string } & P<CoachingMessageRow>, P<CoachingMessageRow>>;
      analytics_events: T<AnalyticsEventRow, { type?: string } & P<AnalyticsEventRow>, P<AnalyticsEventRow>>;
    };
    Views: { [_ in never]: never };
    Functions: {
      match_opportunities: { Args: { query_embedding: string; match_count?: number }; Returns: { opportunity_id: string; similarity: number }[] };
    };
    Enums: { job_type: JobType; work_mode: WorkMode; app_status: AppStatus; resume_target: ResumeTarget; doc_type: DocType };
    CompositeTypes: { [_ in never]: never };
  };
}
