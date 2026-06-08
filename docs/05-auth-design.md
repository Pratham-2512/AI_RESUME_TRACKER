# 05 — Authentication & Authorization

## 1. Provider

Supabase Auth (GoTrue). Enabled methods:

- Email + password (with email confirmation).
- Magic link (passwordless).
- Google OAuth.

JWTs are issued by Supabase; `auth.uid()` inside Postgres drives every RLS policy.

## 2. Clients (the three Supabase clients)

```
lib/supabase/
  server.ts    createServerClient()  — cookie-bound, RLS as the logged-in user. RSC + actions + routes.
  browser.ts   createBrowserClient() — anon key, RLS. Client components only.
  admin.ts     createAdminClient()   — SERVICE ROLE, bypasses RLS. Worker/cron ONLY. Never imported in app/.
```

`admin.ts` exports are guarded: the module throws if `SUPABASE_SERVICE_ROLE_KEY` is
absent, and an ESLint `no-restricted-imports` rule forbids importing it from `app/**`.

## 3. Session flow (App Router)

```
@supabase/ssr handles cookie-based sessions.
- middleware.ts refreshes the session on every request and gates protected routes.
- Server components read the session via createServerClient() (cookies()).
- Client components use the browser client + onAuthStateChange for reactivity.
```

`middleware.ts`:

```ts
// pseudo
const { data: { user } } = await supabase.auth.getUser()
const isProtected = pathname.startsWith('/app')
if (isProtected && !user)  redirect('/login')
if (pathname.startsWith('/login') && user) redirect('/app')
```

Public routes: `/`, `/login`, `/signup`, `/auth/callback`, marketing pages.
Protected: everything under `/app/**`.

## 4. OAuth callback

```
/auth/callback  (Route Handler) — exchanges ?code for a session, sets cookies, redirects to /app.
```

## 5. Authorization model

- **Tenant isolation** is enforced by Postgres RLS, not app code. Even if a query forgets
  a `where user_id = ...`, RLS blocks cross-tenant rows. App code still scopes queries for
  performance/clarity, but security does not depend on it.
- **Roles (future / Production phase):** a `role` claim (`user` | `admin`) for an internal
  admin console (manage `job_sources`, inspect `ai_usage_log`). Admin routes check the
  claim server-side; admin DB access uses the service-role client behind an
  authenticated admin route.

## 6. Protecting AI routes

Every `/api/ai/*` handler:

1. `getUser()` → 401 if absent.
2. Per-user rate-limit check → 429 + `retry-after`.
3. Runs with the user-scoped client so all reads/writes obey RLS.
4. Logs to `ai_usage_log` with `user_id`.

## 7. Worker authentication

The worker (scrapers, Playwright, backfills) authenticates to internal routes with a
shared `WORKER_SECRET` (header `x-worker-secret`) and uses the service-role Supabase
client. Internal routes (`/api/internal/**`) reject any request without the secret and are
excluded from the public middleware auth gate.

## 8. Secrets matrix

| Secret | Exposed to browser? | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes (safe; RLS-scoped) | browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | **never** | `admin.ts`, worker |
| `ANTHROPIC_API_KEY` | **never** | `lib/ai` (server) |
| `OPENAI_API_KEY` | **never** | embeddings (server) |
| `WORKER_SECRET` | **never** | worker ↔ internal routes |
