// Full backfill entry point. Pulls all org data from GitHub into MySQL.
//
// Usage:
//   npm run backfill                    # all-time backfill
//   npm run backfill -- --max-repos=3   # smoke test
//
// Reads DATABASE_URL, GITHUB_SYNC_TOKEN, GITHUB_ORG from .env / process env.

import "dotenv/config";
import { closeDb, getDb } from "@/lib/db/client";
import { makeClient } from "@/lib/github";
import { syncOrg } from "@/lib/sync/engine";

function parseArgs(): { maxRepos?: number } {
  const out: { maxRepos?: number } = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--max-repos=")) {
      out.maxRepos = Number(a.slice("--max-repos=".length));
    }
  }
  return out;
}

async function main() {
  const token = process.env.GITHUB_SYNC_TOKEN;
  const org = process.env.GITHUB_ORG;
  if (!token) throw new Error("GITHUB_SYNC_TOKEN missing from env");
  if (!org) throw new Error("GITHUB_ORG missing from env");

  const args = parseArgs();
  const db = await getDb();
  const client = makeClient(token);

  console.log(
    `Backfilling org=${org} (all-time)${args.maxRepos ? ` maxRepos=${args.maxRepos}` : ""}`,
  );
  const start = Date.now();
  const result = await syncOrg(db, client, org, { maxRepos: args.maxRepos });
  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done in ${seconds}s:`, result);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
