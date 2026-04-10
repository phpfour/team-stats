# Next.js 16.2.2 quirks (vs. training data)

Source: `node_modules/next/dist/docs/`. Read the relevant doc before touching any Next API.

## Renames / breaking changes

- **`middleware.ts` → `proxy.ts`.** The `middleware` convention is deprecated. Export a `proxy` function (not `middleware`). Lives at project root or `src/`. Doc: `01-app/03-api-reference/03-file-conventions/proxy.md`.
- **Dynamic route `params` is a Promise.** Must `await params` (or `.then()`) in pages, layouts, route handlers. Each component reading `params` needs its own `<Suspense>` boundary if the segment is dynamic.
- **`searchParams` is also a Promise** in pages. Plan range-selector state accordingly (URL search params live in a Promise on the server).

## New features we should use

- **Cache Components (`'use cache'` directive).** Mark async functions/components as cacheable. Use `cacheLife` for TTL, `cacheTag` for invalidation, `updateTag` to bust. Replaces ad-hoc `unstable_cache`. Enabled via `cacheComponents: true` in `next.config.ts`.
- **`unstable_instant` route export.** Validates that a route renders an instant static shell at every entry point (page load AND sibling client navigations). Errors at dev/build if a Suspense boundary is misplaced.
  - For our dashboard layout (cookie-reading, user-specific, dynamic), set `export const unstable_instant = false` on the `(dashboard)` layout to opt out.
  - Can still enable on specific inner pages later if we want instant sibling nav.
- **Partial Prerendering (PPR) + streaming** are first-class. Cloudflare Workers supports PPR resuming.

## Cloudflare deployment

- Next.js has an **Adapter API** (`adapterPath` in `next.config`). Cloudflare is NOT a built-in target — use `@opennextjs/cloudflare` (community/verified adapter).
- Cloudflare-specific primitives we'll lean on per the deploy doc: **Workers** (edge compute), **KV** (key-value/tags), **R2** (blob storage if needed). D1 is not in the platform doc's table but is fine for our app DB.
- For functional fidelity on Workers, the adapter handles streaming, `cacheHandlers` (for `'use cache'`), and `cacheHandler` (for ISR/route-handler caching). Don't fight it — let opennext do its thing.

## Env vars

- `.env*` files load into `process.env` as usual. **But** on Cloudflare, runtime env comes from `wrangler.toml` `[vars]` and `wrangler secret put`. Local dev uses `.dev.vars`. We won't rely on `process.env` in worker code paths — read from the request context binding the adapter exposes.

## React version

- App Router uses **React 19 canary** built into Next, not what's in `package.json`. Don't be surprised if React features appear unfamiliar — check Next's bundled React, not training-data React 18.

## File conventions reference (relevant to us)

- `app/layout.tsx`, `app/page.tsx`, `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`
- Route handlers: `app/**/route.ts` (doc: `03-file-conventions/route.md`)
- Route groups: `app/(dashboard)/...` — used in our planned structure
- Dynamic segments: `app/members/[login]/page.tsx`

## Functions to know about (from `04-functions/`)

- `cookies()`, `headers()` — **async**, return Promises in 16.x. Always `await`.
- `redirect()`, `permanentRedirect()` — throw, don't return.
- `revalidateTag()` / `updateTag()` — `updateTag` is the new one for Cache Components.
- `after()` — run work after the response is sent (e.g. log a sync hit). Needs platform graceful-shutdown support; verify Cloudflare adapter handles it before relying on it.

## Things to AVOID assuming from training data

- ❌ `middleware.ts` (use `proxy.ts`)
- ❌ Synchronous `params` / `searchParams` / `cookies()` / `headers()`
- ❌ `getServerSideProps` / `getStaticProps` (Pages Router only — we're App Router)
- ❌ `next/router` `useRouter` from pages — use `next/navigation` `useRouter`
- ❌ `unstable_cache` as the primary caching mechanism — prefer `'use cache'` + `cacheLife`
- ❌ Assuming Node `fs`, native modules, or long-running background loops in route handlers — Workers runtime is constrained

## When in doubt

Doc index: `node_modules/next/dist/docs/01-app/index.md`. Guides under `02-guides/`, API ref under `03-api-reference/`. Read before coding.
