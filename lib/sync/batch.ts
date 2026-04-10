// Page-level upserts. On MySQL there's no subrequest limit, so we can just
// do multi-row INSERT ... ON DUPLICATE KEY UPDATE per resource per page.
// Drizzle handles the multi-row VALUES(...) clause natively.

import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  commits,
  issues,
  pullRequests,
  reviews,
  users,
} from "@/lib/db/schema";
import type {
  NewCommit,
  NewIssue,
  NewPullRequest,
  NewReview,
  NewUser,
} from "@/lib/db/schema";

type DB = MySql2Database<typeof schema>;

function dedupeUsers(rows: NewUser[]): NewUser[] {
  const byLogin = new Map<string, NewUser>();
  for (const r of rows) byLogin.set(r.login, r);
  return Array.from(byLogin.values());
}

// Reference the about-to-be-inserted row's value. MySQL 8+ supports the
// `VALUES(col)` function inside ON DUPLICATE KEY UPDATE (emits a deprecation
// warning but works). For future-proofing we could alias the row, but
// drizzle-orm/mysql-core doesn't currently expose that syntax cleanly.
function vals(col: string) {
  return sql.raw(`VALUES(${col})`);
}

export async function upsertPullRequestPage(
  db: DB,
  userRows: NewUser[],
  prRows: NewPullRequest[],
  reviewRows: NewReview[],
): Promise<void> {
  const deduped = dedupeUsers(userRows);
  if (deduped.length > 0) {
    await db
      .insert(users)
      .values(deduped)
      .onDuplicateKeyUpdate({
        set: {
          name: vals("name"),
          avatarUrl: vals("avatar_url"),
        },
      });
  }
  if (prRows.length > 0) {
    await db
      .insert(pullRequests)
      .values(prRows)
      .onDuplicateKeyUpdate({
        set: {
          title: vals("title"),
          bodyExcerpt: vals("body_excerpt"),
          state: vals("state"),
          mergedAt: vals("merged_at"),
          closedAt: vals("closed_at"),
          firstReviewAt: vals("first_review_at"),
          additions: vals("additions"),
          deletions: vals("deletions"),
        },
      });
  }
  if (reviewRows.length > 0) {
    await db
      .insert(reviews)
      .values(reviewRows)
      .onDuplicateKeyUpdate({
        set: {
          state: vals("state"),
          bodyExcerpt: vals("body_excerpt"),
          submittedAt: vals("submitted_at"),
        },
      });
  }
}

export async function upsertIssuePage(
  db: DB,
  userRows: NewUser[],
  issueRows: NewIssue[],
): Promise<void> {
  const deduped = dedupeUsers(userRows);
  if (deduped.length > 0) {
    await db
      .insert(users)
      .values(deduped)
      .onDuplicateKeyUpdate({
        set: {
          name: vals("name"),
          avatarUrl: vals("avatar_url"),
        },
      });
  }
  if (issueRows.length > 0) {
    await db
      .insert(issues)
      .values(issueRows)
      .onDuplicateKeyUpdate({
        set: {
          title: vals("title"),
          bodyExcerpt: vals("body_excerpt"),
          state: vals("state"),
          closedAt: vals("closed_at"),
        },
      });
  }
}

export async function upsertCommitPage(
  db: DB,
  userRows: NewUser[],
  commitRows: NewCommit[],
): Promise<void> {
  const deduped = dedupeUsers(userRows);
  if (deduped.length > 0) {
    await db
      .insert(users)
      .values(deduped)
      .onDuplicateKeyUpdate({
        set: {
          name: vals("name"),
          avatarUrl: vals("avatar_url"),
        },
      });
  }
  if (commitRows.length > 0) {
    await db
      .insert(commits)
      .values(commitRows)
      .onDuplicateKeyUpdate({
        set: {
          message: vals("message"),
          additions: vals("additions"),
          deletions: vals("deletions"),
        },
      });
  }
}
