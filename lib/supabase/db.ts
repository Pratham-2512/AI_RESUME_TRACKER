import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Single-user data client. Uses the service_role key, so it bypasses RLS and is
 * the ONLY way the app reads/writes data (the anon key never touches data).
 * Server-only. Cached across calls in a module-level singleton.
 *
 * IMPORTANT — env resolution order:
 *   SUPABASE_URL is preferred over NEXT_PUBLIC_SUPABASE_URL. NEXT_PUBLIC_* values
 *   are INLINED at BUILD time, so if a production build ran before the var existed
 *   (or reused a cached build), the inlined value is `undefined` and NO runtime
 *   value can override it. SUPABASE_URL is a server-only var read FRESH from the
 *   runtime environment, which is immune to that build-time inlining trap.
 *
 * The client is created lazily inside createDb() — never at module load — so that
 * `next build` page-data collection (which has no env) cannot throw at import time.
 */
let client: SupabaseClient<Database> | null = null;

/** Resolve config from the runtime environment. Called per request, not at import. */
function resolveSupabaseConfig(): { url?: string; key?: string } {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim() || undefined;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
  return { url, key };
}

export function createDb(): SupabaseClient<Database> {
  if (client) return client;

  const { url, key } = resolveSupabaseConfig();
  const missing = [
    !url && "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)",
    !key && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Supabase is not configured. Missing env: ${missing.join(", ")}.`);
  }

  client = createSupabaseClient<Database>(url!, key!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
