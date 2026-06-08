import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * SERVICE-ROLE client — bypasses RLS. WORKER / internal routes / cron ONLY.
 * Never import from app pages or client components.
 * (Enforce with an ESLint no-restricted-imports rule for app/** — see docs/11.)
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Admin client requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
