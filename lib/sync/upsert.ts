// Single-row upsert helpers used by the engine for one-off writes like
// repo metadata and the sync_state cursor. Page-level bulk upserts live in
// ./batch.ts.

import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { repos } from "@/lib/db/schema";
import type { NewRepo } from "@/lib/db/schema";

type DB = MySql2Database<typeof schema>;

function vals(col: string) {
  return sql.raw(`VALUES(${col})`);
}

export async function upsertRepo(db: DB, row: NewRepo): Promise<void> {
  await db
    .insert(repos)
    .values(row)
    .onDuplicateKeyUpdate({
      set: {
        name: vals("name"),
        defaultBranch: vals("default_branch"),
        archived: vals("archived"),
      },
    });
}
