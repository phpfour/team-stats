// Cron entry point. Run by Forge's scheduler:
//
//   */15 * * * *  cd /var/www/stats.klasio.dev && npm run sync:incremental
//   0 3 * * *     cd /var/www/stats.klasio.dev && npm run sync:full
//
// Reads DATABASE_URL, GITHUB_SYNC_TOKEN, GITHUB_ORG from .env / process env.

import "dotenv/config";
import { closeDb, getDb } from "@/lib/db/client";
import { makeClient } from "@/lib/github";
import { syncOrg } from "@/lib/sync/engine";

const INCREMENTAL_WINDOW_MINUTES = 30; // overlap with the 15m cron

async function main() {
  const mode: "incremental" | "full" =
    process.argv[2] === "full" ? "full" : "incremental";

  const token = process.env.GITHUB_SYNC_TOKEN;
  const org = process.env.GITHUB_ORG;
  if (!token) throw new Error("GITHUB_SYNC_TOKEN missing from env");
  if (!org) throw new Error("GITHUB_ORG missing from env");

  const since =
    mode === "incremental"
      ? new Date(Date.now() - INCREMENTAL_WINDOW_MINUTES * 60 * 1000).toISOString()
      : undefined;

  const db = await getDb();
  const client = makeClient(token);

  const start = Date.now();
  const result = await syncOrg(db, client, org, { since });
  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `[${new Date().toISOString()}] ${mode} sync done in ${seconds}s:`,
    result,
  );
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
