# 11 — Security Design

## 1. Trust boundaries

```
Browser (anon key, RLS)  →  Vercel server (user JWT / service role)  →  Supabase (RLS)
                                     │
                                     └→ Anthropic / OpenAI (server keys)
Worker (service role, WORKER_SECRET) →  internal routes only
```

The browser is untrusted. Security is enforced at the **database** (RLS), not in app code.

## 2. Tenant isolation (primary control)

- RLS enabled on **every** table; default deny.
- Per-user tables: `auth.uid() = user_id` on select/insert/update/delete.
- `jobs`/`job_sources`: authenticated read-only; writes need service role.
- Tested by an automated isolation test: sign in as user A and user B, assert A cannot
  read/modify B's rows through the anon/authenticated client.

## 3. Secrets

| Secret | Location | Never |
|---|---|---|
| anon key | client (safe, RLS-scoped) | — |
| service role | Vercel server env + worker secrets | bundled to client, logged |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | server env | client, logs, prompts |
| `WORKER_SECRET` | server + worker | client |

Enforcement: ESLint `no-restricted-imports` blocks `lib/supabase/admin` from `app/**`
(except `app/api/internal/**`); CI greps the client bundle for service-role leakage.

## 4. PII handling

- Resumes contain PII (name, email, phone, history). Stored in a **private** Storage
  bucket, per-user prefix policy, signed URLs (60s TTL). Raw bucket never public.
- AI calls send only what a feature needs; we don't send other users' data.
- Right-to-delete: deleting `auth.users` cascades all per-user rows (`on delete cascade`)
  and a cleanup job removes the user's Storage prefix.
- Don't store secrets/passwords in `copilot_messages` or generated docs.

## 5. AI-specific risks

| Risk | Mitigation |
|---|---|
| Prompt injection via scraped job text / uploaded résumé | Treat all retrieved/user content as **data, not instructions**. System prompt states content is untrusted; tools are allow-listed; copilot tools are RLS-scoped so a malicious instruction can't read another tenant. |
| Hallucinated/fabricated résumé content | Rewrite/interview prompts forbid invention; drafts require user review before use. |
| Cost abuse | Per-user rate limits + token quotas; `ai_usage_log` monitored; alerts on spikes. |
| Refusals / safety stops | Handle `stop_reason: refusal` gracefully; never retry blindly. |

## 6. Automation safety (Module 10)

- **No auto-submit, ever.** `application_runs.approved_at` must be set by an explicit user
  action; `/assist` and `/submitted` return 409 if it's null.
- Playwright only **fills** fields; the human clicks submit on the real site.
- Form-fill runs in the isolated worker, scoped to a single run, with a short-lived token.
- Respect target-site ToS / robots; the assist is user-initiated and user-supervised.

## 7. Input validation & abuse

- All action/route inputs validated with Zod; reject oversized uploads (résumé ≤ 10MB,
  PDF/DOCX only, content-type checked server-side).
- File names sanitized (`path.basename`) before any storage/processing.
- Rate limit auth endpoints; rely on Supabase Auth lockout/captcha for brute force.

## 8. Network & transport
- HTTPS everywhere; secure, httpOnly, sameSite cookies (via `@supabase/ssr`).
- Internal routes require `x-worker-secret` and are excluded from public auth gate.
- CSP + standard security headers in `next.config` / middleware.

## 9. Observability for security
- Sentry for errors; structured request logs (no PII/secrets in logs).
- Audit trail: `application_events` (status changes), `ai_usage_log` (who/what/cost),
  Supabase auth logs.

## 10. Compliance posture (MVP → prod)
- MVP: least-privilege, encryption at rest (Supabase default) + in transit, deletion path.
- Prod: documented data-retention, DPA with subprocessors (Anthropic/OpenAI/Supabase/
  Vercel), privacy policy, opt-out of training (API data isn't used for training), and
  region pinning if EU users require it.
