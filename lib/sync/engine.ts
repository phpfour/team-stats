// High-level sync orchestration. Iterates org repos, syncs each one's PRs,
// issues and commits via page-level batched upserts. Designed for Node
// (no subrequest limits) — runs from scripts/backfill.ts and scripts/sync.ts.

import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { syncState } from "@/lib/db/schema";
import {
  GithubError,
  listOrgRepos,
  listRepoCommitsPages,
  listRepoIssuesPages,
  listRepoPullRequestsPages,
  type GithubClient,
} from "@/lib/github";
import type {
  NewCommit,
  NewIssue,
  NewPullRequest,
  NewReview,
  NewUser,
} from "@/lib/db/schema";
import {
  commitFromGh,
  issueFromGh,
  prFromGh,
  repoFromGh,
  userStub,
} from "./transform";
import { upsertRepo } from "./upsert";
import {
  upsertCommitPage,
  upsertIssuePage,
  upsertPullRequestPage,
} from "./batch";

type DB = MySql2Database<typeof schema>;

export type SyncOptions = {
  /** ISO timestamp; if set, only fetch resources updated since this time. */
  since?: string;
  /** Limit number of repos processed (useful for smoke tests). */
  maxRepos?: number;
};

export type SyncResult = {
  repos: number;
  prs: number;
  issues: number;
  commits: number;
  processed: string[];
};

export async function syncOrg(
  db: DB,
  client: GithubClient,
  org: string,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  let repoCount = 0;
  let prCount = 0;
  let issueCount = 0;
  let commitCount = 0;
  const names: string[] = [];

  for await (const ghRepo of listOrgRepos(client, org)) {
    if (opts.maxRepos && repoCount >= opts.maxRepos) break;
    const repo = repoFromGh(ghRepo);
    await upsertRepo(db, repo);
    repoCount++;
    names.push(repo.name);

    const r = await syncRepo(db, client, repo.id!, repo.name, opts);
    prCount += r.prs;
    issueCount += r.issues;
    commitCount += r.commits;
  }

  return {
    repos: repoCount,
    prs: prCount,
    issues: issueCount,
    commits: commitCount,
    processed: names,
  };
}

export async function syncRepo(
  db: DB,
  client: GithubClient,
  repoId: number,
  ownerName: string,
  opts: SyncOptions = {},
): Promise<{ prs: number; issues: number; commits: number }> {
  const sinceEpoch = opts.since
    ? Math.floor(new Date(opts.since).getTime() / 1000)
    : 0;
  let prs = 0;
  let issues = 0;
  let commits = 0;

  // ---- Pull Requests (page-batched) ----
  outerPr: for await (const page of listRepoPullRequestsPages(
    client,
    ownerName,
  )) {
    const userRows: NewUser[] = [];
    const prRows: NewPullRequest[] = [];
    const reviewRows: NewReview[] = [];
    let stopAfterPage = false;
    for (const gh of page) {
      if (sinceEpoch && new Date(gh.updatedAt).getTime() / 1000 < sinceEpoch) {
        stopAfterPage = true;
        break;
      }
      const { pr, reviews: revs, logins } = prFromGh(gh, repoId);
      prRows.push(pr);
      reviewRows.push(...revs);
      for (const l of logins) userRows.push(userStub(l));
      prs++;
    }
    await upsertPullRequestPage(db, userRows, prRows, reviewRows);
    if (stopAfterPage) break outerPr;
  }
  await markSynced(db, "pulls", repoId);

  // ---- Issues (page-batched) ----
  outerIs: for await (const page of listRepoIssuesPages(client, ownerName)) {
    const userRows: NewUser[] = [];
    const issueRows: NewIssue[] = [];
    let stopAfterPage = false;
    for (const gh of page) {
      if (sinceEpoch && new Date(gh.updatedAt).getTime() / 1000 < sinceEpoch) {
        stopAfterPage = true;
        break;
      }
      const { issue, logins } = issueFromGh(gh, repoId);
      issueRows.push(issue);
      for (const l of logins) userRows.push(userStub(l));
      issues++;
    }
    await upsertIssuePage(db, userRows, issueRows);
    if (stopAfterPage) break outerIs;
  }
  await markSynced(db, "issues", repoId);

  // ---- Commits (page-batched) ----
  // GitHub returns 409 for empty repos and 404 for missing refs — both mean
  // "nothing to sync here", not a real error.
  try {
    for await (const page of listRepoCommitsPages(
      client,
      ownerName,
      opts.since,
    )) {
      const userRows: NewUser[] = [];
      const commitRows: NewCommit[] = [];
      for (const gh of page) {
        const { commit, logins } = commitFromGh(gh, repoId);
        commitRows.push(commit);
        for (const l of logins) userRows.push(userStub(l));
        commits++;
      }
      await upsertCommitPage(db, userRows, commitRows);
    }
  } catch (err) {
    if (err instanceof GithubError && (err.status === 409 || err.status === 404)) {
      // empty or missing — leave commits at 0
    } else {
      throw err;
    }
  }
  await markSynced(db, "commits", repoId);

  return { prs, issues, commits };
}

async function markSynced(db: DB, resource: string, repoId: number) {
  const now = Math.floor(Date.now() / 1000);
  await db
    .insert(syncState)
    .values({ resource, repoId, lastCursor: null, lastRunAt: now })
    .onDuplicateKeyUpdate({
      set: { lastRunAt: sql.raw(`VALUES(last_run_at)`) },
    });
}
