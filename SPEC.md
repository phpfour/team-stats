# github-stats — Specification

## 1. Objective

A CTO-facing analytics dashboard for the **klasio** GitHub organization (https://github.com/klasio). Provides an org-wide overview and per-member drill-downs across day/week/month/custom time ranges, with comparison to the previous period.

**Primary user:** CTO of klasio (single-org, single-tenant for v1).
**Allowed users:** GitHub usernames `phpfour` and `ajaxray` only. All other logins are rejected even if they belong to the org.

## 2. Core Features (v1)

1. **GitHub OAuth login**, restricted to the username allowlist above. Session stored in KV.
2. **Org overview dashboard** with metrics across all klasio repos (public + private):
   - PRs opened, PRs merged, PRs closed-without-merge
   - Reviews submitted (approved / changes requested / commented)
   - Commits authored
   - Issues opened / closed
   - **Time to first review** (median + p90)
   - **Cycle time** (PR open → merge, median + p90)
   - Top contributors leaderboard
   - Activity heatmap (contributions per day)
3. **Member drill-down** — same metrics scoped to one user, plus per-repo breakdown and a recent activity feed.
4. **Time range selector** — day / week / month / custom date range, with delta vs. previous equivalent period.
5. **Background sync** — Cloudflare Cron Triggers pull from GitHub on a schedule and write to D1; the dashboard reads from D1, never live from GitHub.
6. **First-run backfill** — full historical sync of all klasio repos from inception (all-time).

## 3. Tech Stack

Everything runs on Cloudflare.

- **Framework:** Next.js (this repo's vendored version — read `node_modules/next/dist/docs/` before writing any code per AGENTS.md)
- **Deploy target:** Cloudflare Workers via `@opennextjs/cloudflare`
- **Database:** Cloudflare D1 (SQLite) with **Drizzle ORM** for typed schema + migrations
- **Sessions / cache:** Cloudflare KV
- **Scheduled sync:** Cloudflare Cron Triggers (Workers) — incremental every 15 min, full reconcile nightly
- **GitHub API:** GraphQL v4 primary, REST v3 where needed; auth via the logged-in user's OAuth token for ad-hoc queries and a dedicated GitHub App / PAT for the background sync
- **Auth:** GitHub OAuth App, username allowlist enforced server-side
- **UI:** Tailwind CSS + shadcn/ui components; **Recharts** for charts
- **Testing:** Vitest (unit), Playwright (a couple of smoke E2E)
- **Lint/format:** ESLint + Prettier (whatever Next ships with)

## 4. Project Structure (proposed)

```
/app                    # Next.js routes (App Router)
  /(auth)/login
  /(dashboard)/overview
  /(dashboard)/members/[login]
  /api/auth/[...]       # OAuth callback
  /api/sync             # Manual sync trigger (admin only)
/lib
  /github               # GraphQL client, queries, REST fallbacks
  /db                   # Drizzle schema, migrations, queries
  /metrics              # Metric calculation (cycle time, TTFR, etc.)
  /auth                 # Session, allowlist enforcement
/workers
  /sync                 # Cron-triggered sync worker
/drizzle                # Migration files
/tests
SPEC.md
wrangler.toml
```

## 5. Code Style

- TypeScript strict mode everywhere
- Server Components by default; Client Components only where interactivity is needed
- Database access only through `/lib/db` (no inline SQL in routes)
- GitHub API access only through `/lib/github`
- Metric calculations are pure functions in `/lib/metrics`, unit-tested
- No `any`. No silent catches. Errors bubble to route handlers which render proper error UI.

## 6. Testing Strategy

- **Unit (Vitest):** all functions in `/lib/metrics` (cycle time, TTFR, period comparison math). Mock D1 with an in-memory SQLite for `/lib/db` query tests.
- **Integration:** sync worker against a recorded GitHub GraphQL fixture.
- **E2E (Playwright, smoke only):** login redirect, overview renders, member drill-down renders.
- **No mocking the database in integration tests** — use a real local D1.
- A task is not done until its tests pass.

## 7. Boundaries

**Always:**
- Read the relevant doc in `node_modules/next/dist/docs/` before using any Next.js API
- Enforce the username allowlist on every authenticated route, server-side
- Store GitHub tokens encrypted in KV; never log them
- Respect GitHub API rate limits — incremental sync uses `since` cursors

**Ask first:**
- Adding any new Cloudflare binding (D1 db, KV namespace, secret, cron) — these touch `wrangler.toml` and need user action to provision
- Any schema migration after the first one
- Adding a new npm dependency not listed in this spec

**Never:**
- Run live GitHub API calls from page renders (always read from D1)
- Commit secrets, tokens, or `.dev.vars` to git
- Add a second org or multi-tenancy without a spec update
- Use destructive D1 commands without confirmation

## 8. Open Items (deferred past v1)

- Multi-org support
- Public sharing / read-only links
- Webhook-driven real-time updates (v1 is cron-pull only)
- DORA metrics beyond cycle time (deploy freq, MTTR, change failure rate)
- Slack/email digests
