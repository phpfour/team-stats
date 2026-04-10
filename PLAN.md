# github-stats — Implementation Plan

Tasks are ordered by dependency. Each is sized to land in one focused step with a clear verification. **Bold** tasks need user action (provisioning, secrets) before I can proceed.

---

## Phase 0 — Foundation

### T0.1 — Read the vendored Next.js docs
Per AGENTS.md, this Next.js is non-standard. Skim `node_modules/next/dist/docs/` for: routing, server components, route handlers, middleware, env vars, deployment notes.
**Verify:** Short notes file `.notes/next-quirks.md` listing anything that diverges from upstream Next.

### T0.2 — Inventory current repo
Read `package.json`, `next.config.*`, `tsconfig.json`, existing `app/` to know what the Create Next App scaffold gave us.
**Verify:** Confirm baseline builds with `npm run build`.

### T0.3 — Add Cloudflare adapter + Wrangler
Install `@opennextjs/cloudflare` and `wrangler`. Create initial `wrangler.toml` (name, compat date, empty bindings stubs). Add `npm run preview` (opennext build + wrangler dev) and `npm run deploy` scripts.
**Verify:** `npm run preview` boots the default app locally on Workers runtime.

### **T0.4 — User: provision Cloudflare resources**
You run:
- `wrangler d1 create github-stats` → paste the database_id
- `wrangler kv namespace create SESSIONS` → paste the id
- `wrangler kv namespace create CACHE` → paste the id

I wire them into `wrangler.toml`.
**Verify:** `wrangler d1 list` and `wrangler kv namespace list` show all three.

---

## Phase 1 — Auth

### **T1.1 — User: create GitHub OAuth App**
You create an OAuth App at github.com/settings/developers with callback `http://localhost:8788/api/auth/callback` (and prod URL later). Share Client ID; put Client Secret in `.dev.vars` and `wrangler secret put GITHUB_CLIENT_SECRET`. Also generate a `SESSION_SECRET` (random 32 bytes).
**Verify:** `.dev.vars` has the three values; `wrangler secret list` shows them in prod env.

### T1.2 — Auth library
Build `/lib/auth`: OAuth flow (authorize → callback → token exchange), session creation in KV (signed cookie → KV lookup), `getSession()` helper, `requireUser()` server helper that enforces the `phpfour`/`ajaxray` allowlist.
**Verify:** Vitest unit tests for cookie signing, allowlist enforcement (allowed/denied/unauth cases).

### T1.3 — Auth routes + middleware
Implement `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`. Middleware redirects unauthenticated users from `/(dashboard)/*` to `/login`.
**Verify:** Manual: log in as allowed user → land on `/overview`; log in as anyone else → see "Not authorized" page.

---

## Phase 2 — Database

### T2.1 — Drizzle setup + initial schema
Install `drizzle-orm`, `drizzle-kit`, `better-sqlite3` (for local tests). Define schema in `/lib/db/schema.ts`:
- `repos` (id, name, default_branch, created_at, archived)
- `users` (login, name, avatar_url)
- `pull_requests` (id, repo_id, number, author, state, created_at, merged_at, closed_at, first_review_at, additions, deletions)
- `reviews` (id, pr_id, reviewer, state, submitted_at)
- `commits` (sha, repo_id, author_login, committed_at, additions, deletions)
- `issues` (id, repo_id, number, author, state, created_at, closed_at)
- `sync_state` (resource, repo_id, last_cursor, last_run_at)

Generate first migration.
**Verify:** `drizzle-kit generate` produces SQL; `wrangler d1 migrations apply --local` succeeds; round-trip insert/select test passes.

### T2.2 — D1 query layer
Write typed query helpers in `/lib/db/queries.ts` for the reads the dashboard needs (no inline SQL outside this file). Cover: org metrics over range, user metrics over range, top contributors, activity heatmap data, per-repo breakdown.
**Verify:** Vitest tests against in-memory SQLite with seeded fixtures.

---

## Phase 3 — GitHub Sync

### **T3.1 — User: provide sync token**
Create a fine-grained PAT (or GitHub App) with read access to all klasio repos (code metadata, PRs, issues, contents). Store as `GITHUB_SYNC_TOKEN` via `wrangler secret put` and in `.dev.vars`.
**Verify:** Token scoped to klasio org with required read perms.

### T3.2 — GitHub client
Build `/lib/github`: GraphQL client with rate-limit awareness, REST fallback, typed query functions for: list org repos, list PRs (paginated by `updatedAt`), list reviews per PR, list commits, list issues.
**Verify:** Vitest tests using recorded fixtures; live smoke script hits klasio and prints repo count.

### T3.3 — Sync engine
`/lib/sync`: pure functions that take GitHub responses and upsert into D1 via the query layer. Idempotent. Tracks `sync_state` cursors so incremental runs only fetch what changed.
**Verify:** Unit tests: running the same fixture twice produces the same DB state. Integration test against local D1.

### T3.4 — First-run backfill script
`scripts/backfill.ts` runnable via `wrangler dev` or as a one-shot Worker invocation. Walks all klasio repos from inception. Resumable (uses `sync_state`).
**Verify:** Run against klasio locally; D1 has plausible row counts; re-running is a no-op for already-synced ranges.

### T3.5 — Cron-triggered incremental sync
Add a Worker entry point + cron trigger in `wrangler.toml` (every 15 min). Calls the sync engine in incremental mode.
**Verify:** `wrangler dev --test-scheduled` triggers it; logs show updates fetched and `sync_state.last_run_at` advances.

---

## Phase 4 — Metrics

### T4.1 — Metric calculation library
`/lib/metrics`: pure functions taking date-bounded query results and producing:
- PRs opened/merged/closed counts
- Review counts by state
- Commit count
- Issues opened/closed
- Time to first review (median, p90)
- Cycle time (median, p90)
- Period comparison (current vs. previous equivalent window)
- Activity heatmap buckets

**Verify:** Vitest with hand-crafted fixtures covering edge cases (empty range, single PR, unreviewed PRs, weekend gaps).

---

## Phase 5 — UI

### T5.1 — Tailwind + shadcn/ui setup
Install Tailwind (via Next's setup) and a minimal shadcn/ui baseline (button, card, select, date-range-picker, table, skeleton, tabs).
**Verify:** A throwaway `/_design` route renders one of each component.

### T5.2 — App shell + nav
Layout for `(dashboard)`: top bar with org name, time-range selector (day/week/month/custom + previous-period toggle), user menu, logout. Range state lives in URL search params.
**Verify:** Manual: changing range updates URL; refresh preserves state.

### T5.3 — Overview page
`/overview`: KPI cards (PRs merged, reviews, commits, TTFR, cycle time), top contributors table, activity heatmap, deltas vs. previous period. Server Component reads via `/lib/db/queries`.
**Verify:** Renders against seeded D1; numbers match metric unit tests for the same fixture.

### T5.4 — Member drill-down
`/members/[login]`: same KPIs scoped to user, per-repo breakdown table, recent activity feed (latest PRs/reviews/commits).
**Verify:** Manual: visit `/members/phpfour` and `/members/ajaxray`; numbers reconcile with overview totals when summed.

### T5.5 — Charts
Add Recharts. Cycle-time-over-time line, contributions-per-day bar, review-state pie. Reuse on overview and member pages.
**Verify:** Charts render without runtime errors; axes labeled; empty state handled.

---

## Phase 6 — Ship

### T6.1 — E2E smoke tests
Playwright: login redirect, overview renders authenticated, member page renders, range change updates numbers.
**Verify:** `npm run test:e2e` green locally.

### T6.2 — Pre-launch checklist
Production secrets set, `wrangler.toml` reviewed, cron trigger confirmed, OAuth callback URL updated to prod, error pages styled, no `console.log` of tokens.
**Verify:** Checklist file committed; each item ticked.

### **T6.3 — User: deploy**
`npm run deploy`. First deploy I'll walk through with you. Then trigger backfill once in prod.
**Verify:** Prod URL loads, login works, overview shows data after backfill completes.

---

## Critical Path & Parallelism

Strictly sequential: T0.1 → T0.2 → T0.3 → **T0.4** → T1.1...

Parallelizable once Phase 2 lands:
- Phase 3 (sync) and Phase 4 (metrics) can proceed in parallel — metrics work against fixtures, sync work against GitHub
- Phase 5 (UI) can start with mocked query results as soon as T2.2 defines the query layer signatures

## Tasks Needing You (in order)
1. **T0.4** — provision D1 + KV
2. **T1.1** — create GitHub OAuth app + secrets
3. **T3.1** — provide GitHub sync token
4. **T6.3** — final deploy
