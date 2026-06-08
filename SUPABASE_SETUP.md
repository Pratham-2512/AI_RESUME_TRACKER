# Supabase Setup — run when ready

Everything below gets the app running live. ~10 minutes.

## 1. Create the project
1. Go to https://supabase.com → New project. Pick a region near you, set a DB password.
2. Project Settings → **API**: copy `Project URL`, `anon public` key, `service_role` key.

## 2. Get API keys
- Anthropic: https://console.anthropic.com → API Keys → `ANTHROPIC_API_KEY`.
- OpenAI (embeddings only): https://platform.openai.com → API Keys → `OPENAI_API_KEY`.

## 3. Fill `.env.local` (create from `.env.example`)
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=<service role key>
ANTHROPIC_API_KEY=<key>
OPENAI_API_KEY=<key>
WORKER_SECRET=<any long random string>
```
> `.env.local` is gitignored. Never commit it. NEXT_PUBLIC_* are inlined into the client bundle (safe — RLS-scoped). The rest stay server-side.

## 4. Apply the schema
Option A — Supabase CLI (recommended):
```powershell
npm i -g supabase
supabase login
supabase link --project-ref <your-ref>
supabase db push        # applies supabase/migrations/0001_initial_schema.sql
```
Option B — Dashboard: open the SQL Editor, paste the contents of
`supabase/migrations/0001_initial_schema.sql`, run it. Then paste `supabase/seed.sql`.

## 5. Enable auth providers
- Dashboard → Authentication → Providers → **Email** (on). For dev, turn off
  "Confirm email" to skip the email step, or keep it on and use the magic link.
- **Google**: add OAuth client (Google Cloud Console), set redirect to
  `https://<ref>.supabase.co/auth/v1/callback`, paste client id/secret.
- Authentication → URL Configuration → Site URL = `http://localhost:3000`,
  add `http://localhost:3000/auth/callback` to redirect allow-list.

## 6. Storage
The migration already creates the private `resumes` bucket + owner policy.
Verify under Storage → Buckets (`resumes`, not public).

## 7. (Optional) Regenerate typed DB client
After any schema change:
```powershell
supabase gen types typescript --linked > lib/supabase/database.types.ts
```
A hand-written `database.types.ts` is already committed so the app is typed before you
run this — regenerate to keep it exact.

## 8. Run
```powershell
npm run dev      # http://localhost:3000
```
Sign up → confirm (or magic link) → you land on /app/dashboard.

## Smoke test
- [ ] Sign up + sign in works; refresh keeps you logged in.
- [ ] Visiting /app/* while logged out redirects to /login.
- [ ] Profile edits save and persist.
- [ ] Résumé upload lands in Storage under `resumes/<your-uid>/`.
- [ ] Résumé analyze returns an ATS score.
