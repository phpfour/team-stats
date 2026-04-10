import { and, between, count, desc, eq, isNotNull, lt } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "./schema";
import { commits, issues, pullRequests, repos, reviews } from "./schema";

type AnyDB = MySql2Database<typeof schema>;

export type Range = { from: number; to: number };

export type OrgMetrics = {
  prsOpened: number;
  prsMerged: number;
  prsClosedWithoutMerge: number;
  reviews: number;
  commits: number;
  issuesOpened: number;
  issuesClosed: number;
};

export async function getOrgMetrics(
  db: AnyDB,
  range: Range,
): Promise<OrgMetrics> {
  const [prsOpened] = await db
    .select({ n: count() })
    .from(pullRequests)
    .where(between(pullRequests.createdAt, range.from, range.to));

  const [prsMerged] = await db
    .select({ n: count() })
    .from(pullRequests)
    .where(
      and(
        isNotNull(pullRequests.mergedAt),
        between(pullRequests.mergedAt, range.from, range.to),
      ),
    );

  const [prsClosedWithoutMerge] = await db
    .select({ n: count() })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.state, "closed"),
        isNotNull(pullRequests.closedAt),
        between(pullRequests.closedAt, range.from, range.to),
      ),
    );

  const [reviewCount] = await db
    .select({ n: count() })
    .from(reviews)
    .where(between(reviews.submittedAt, range.from, range.to));

  const [commitCount] = await db
    .select({ n: count() })
    .from(commits)
    .where(between(commits.committedAt, range.from, range.to));

  const [issuesOpened] = await db
    .select({ n: count() })
    .from(issues)
    .where(between(issues.createdAt, range.from, range.to));

  const [issuesClosed] = await db
    .select({ n: count() })
    .from(issues)
    .where(
      and(
        isNotNull(issues.closedAt),
        between(issues.closedAt, range.from, range.to),
      ),
    );

  return {
    prsOpened: prsOpened.n,
    prsMerged: prsMerged.n,
    prsClosedWithoutMerge: prsClosedWithoutMerge.n,
    reviews: reviewCount.n,
    commits: commitCount.n,
    issuesOpened: issuesOpened.n,
    issuesClosed: issuesClosed.n,
  };
}

export async function getUserMetrics(
  db: AnyDB,
  login: string,
  range: Range,
): Promise<OrgMetrics> {
  const [prsOpened] = await db
    .select({ n: count() })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.author, login),
        between(pullRequests.createdAt, range.from, range.to),
      ),
    );

  const [prsMerged] = await db
    .select({ n: count() })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.author, login),
        isNotNull(pullRequests.mergedAt),
        between(pullRequests.mergedAt, range.from, range.to),
      ),
    );

  const [prsClosedWithoutMerge] = await db
    .select({ n: count() })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.author, login),
        eq(pullRequests.state, "closed"),
        isNotNull(pullRequests.closedAt),
        between(pullRequests.closedAt, range.from, range.to),
      ),
    );

  const [reviewCount] = await db
    .select({ n: count() })
    .from(reviews)
    .where(
      and(
        eq(reviews.reviewer, login),
        between(reviews.submittedAt, range.from, range.to),
      ),
    );

  const [commitCount] = await db
    .select({ n: count() })
    .from(commits)
    .where(
      and(
        eq(commits.authorLogin, login),
        between(commits.committedAt, range.from, range.to),
      ),
    );

  const [issuesOpened] = await db
    .select({ n: count() })
    .from(issues)
    .where(
      and(
        eq(issues.author, login),
        between(issues.createdAt, range.from, range.to),
      ),
    );

  const [issuesClosed] = await db
    .select({ n: count() })
    .from(issues)
    .where(
      and(
        eq(issues.author, login),
        isNotNull(issues.closedAt),
        between(issues.closedAt, range.from, range.to),
      ),
    );

  return {
    prsOpened: prsOpened.n,
    prsMerged: prsMerged.n,
    prsClosedWithoutMerge: prsClosedWithoutMerge.n,
    reviews: reviewCount.n,
    commits: commitCount.n,
    issuesOpened: issuesOpened.n,
    issuesClosed: issuesClosed.n,
  };
}

export type ContributorRow = { login: string; prs: number; reviews: number; commits: number };

export async function getTopContributors(
  db: AnyDB,
  range: Range,
  limit = 10,
): Promise<ContributorRow[]> {
  // Pull authored PRs, reviews, and commits in the range and aggregate in JS.
  // For klasio scale this is fine; if it grows we can move to a UNION ALL query.
  const prRows = await db
    .select({ login: pullRequests.author })
    .from(pullRequests)
    .where(between(pullRequests.createdAt, range.from, range.to));

  const reviewRows = await db
    .select({ login: reviews.reviewer })
    .from(reviews)
    .where(between(reviews.submittedAt, range.from, range.to));

  const commitRows = await db
    .select({ login: commits.authorLogin })
    .from(commits)
    .where(between(commits.committedAt, range.from, range.to));

  const map = new Map<string, ContributorRow>();
  const bump = (login: string | null, key: keyof Omit<ContributorRow, "login">) => {
    if (!login) return;
    const row = map.get(login) ?? { login, prs: 0, reviews: 0, commits: 0 };
    row[key]++;
    map.set(login, row);
  };
  for (const r of prRows) bump(r.login, "prs");
  for (const r of reviewRows) bump(r.login, "reviews");
  for (const r of commitRows) bump(r.login, "commits");

  return Array.from(map.values())
    .sort((a, b) => b.prs + b.reviews + b.commits - (a.prs + a.reviews + a.commits))
    .slice(0, limit);
}

export type HeatmapBucket = { day: number; count: number };

/**
 * Activity per UTC day (midnight epoch seconds), counting PRs opened + reviews + commits.
 */
export async function getActivityHeatmap(
  db: AnyDB,
  range: Range,
  login?: string,
): Promise<HeatmapBucket[]> {
  const SECONDS_PER_DAY = 86400;

  const prWhere = login
    ? and(
        between(pullRequests.createdAt, range.from, range.to),
        eq(pullRequests.author, login),
      )
    : between(pullRequests.createdAt, range.from, range.to);
  const prRows = await db
    .select({ at: pullRequests.createdAt })
    .from(pullRequests)
    .where(prWhere);

  const reviewWhere = login
    ? and(
        between(reviews.submittedAt, range.from, range.to),
        eq(reviews.reviewer, login),
      )
    : between(reviews.submittedAt, range.from, range.to);
  const reviewRows = await db
    .select({ at: reviews.submittedAt })
    .from(reviews)
    .where(reviewWhere);

  const commitWhere = login
    ? and(
        between(commits.committedAt, range.from, range.to),
        eq(commits.authorLogin, login),
      )
    : between(commits.committedAt, range.from, range.to);
  const commitRows = await db
    .select({ at: commits.committedAt })
    .from(commits)
    .where(commitWhere);

  const buckets = new Map<number, number>();
  for (const r of [...prRows, ...reviewRows, ...commitRows]) {
    const day = Math.floor(r.at / SECONDS_PER_DAY) * SECONDS_PER_DAY;
    buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day - b.day);
}

/**
 * Pulls PRs merged in range with both createdAt and firstReviewAt populated.
 * Caller computes percentiles via /lib/metrics.
 */
export async function getPrTimings(
  db: AnyDB,
  range: Range,
  login?: string,
): Promise<
  Array<{ createdAt: number; firstReviewAt: number | null; mergedAt: number | null }>
> {
  const where = login
    ? and(
        eq(pullRequests.author, login),
        isNotNull(pullRequests.mergedAt),
        between(pullRequests.mergedAt, range.from, range.to),
      )
    : and(
        isNotNull(pullRequests.mergedAt),
        between(pullRequests.mergedAt, range.from, range.to),
      );

  return db
    .select({
      createdAt: pullRequests.createdAt,
      firstReviewAt: pullRequests.firstReviewAt,
      mergedAt: pullRequests.mergedAt,
    })
    .from(pullRequests)
    .where(where);
}

// ---------- Activity timeline ----------

export type ActivityKind =
  | "pr_opened"
  | "pr_merged"
  | "pr_closed"
  | "review_approved"
  | "review_changes_requested"
  | "review_commented"
  | "commit"
  | "issue_opened"
  | "issue_closed";

export type ActivityEvent = {
  id: string;
  at: number;
  kind: ActivityKind;
  repo: string; // "klasio/api"
  /** Short label like "PR #42" or "commit a1b2c3d" */
  ref: string;
  /** The meaningful one-line title (PR title, issue title, commit subject) */
  title: string;
  /** Optional richer body excerpt for hover/expand */
  body?: string | null;
  /** Optional additions/deletions for PRs */
  additions?: number;
  deletions?: number;
  url: string;
};

const REPO_PREFIX = "https://github.com";

/**
 * Returns the most recent activity events for a user, before a cursor timestamp.
 * Cursor pagination: pass `before = <last item's at>` to get the next page.
 */
export async function getUserActivity(
  db: AnyDB,
  login: string,
  opts: { before?: number; limit?: number } = {},
): Promise<ActivityEvent[]> {
  const limit = opts.limit ?? 30;
  const before = opts.before ?? Number.MAX_SAFE_INTEGER;

  // Repo lookup (small table — pull all once).
  const repoRows = await db
    .select({ id: repos.id, name: repos.name })
    .from(repos);
  const repoMap = new Map<number, string>();
  for (const r of repoRows) repoMap.set(r.id, r.name);

  // PRs opened by login
  const prOpenRows = await db
    .select({
      id: pullRequests.id,
      number: pullRequests.number,
      title: pullRequests.title,
      bodyExcerpt: pullRequests.bodyExcerpt,
      additions: pullRequests.additions,
      deletions: pullRequests.deletions,
      repoId: pullRequests.repoId,
      at: pullRequests.createdAt,
    })
    .from(pullRequests)
    .where(and(eq(pullRequests.author, login), lt(pullRequests.createdAt, before)))
    .orderBy(desc(pullRequests.createdAt))
    .limit(limit);

  // PRs merged by login (author)
  const prMergeRows = await db
    .select({
      id: pullRequests.id,
      number: pullRequests.number,
      title: pullRequests.title,
      bodyExcerpt: pullRequests.bodyExcerpt,
      additions: pullRequests.additions,
      deletions: pullRequests.deletions,
      repoId: pullRequests.repoId,
      at: pullRequests.mergedAt,
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.author, login),
        isNotNull(pullRequests.mergedAt),
        lt(pullRequests.mergedAt, before),
      ),
    )
    .orderBy(desc(pullRequests.mergedAt))
    .limit(limit);

  // PRs closed without merge
  const prCloseRows = await db
    .select({
      id: pullRequests.id,
      number: pullRequests.number,
      title: pullRequests.title,
      bodyExcerpt: pullRequests.bodyExcerpt,
      additions: pullRequests.additions,
      deletions: pullRequests.deletions,
      repoId: pullRequests.repoId,
      at: pullRequests.closedAt,
      mergedAt: pullRequests.mergedAt,
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.author, login),
        eq(pullRequests.state, "closed"),
        isNotNull(pullRequests.closedAt),
        lt(pullRequests.closedAt, before),
      ),
    )
    .orderBy(desc(pullRequests.closedAt))
    .limit(limit);

  // Reviews authored by login (join PR for title + repoId)
  const reviewRows = await db
    .select({
      id: reviews.id,
      state: reviews.state,
      bodyExcerpt: reviews.bodyExcerpt,
      at: reviews.submittedAt,
      number: pullRequests.number,
      prTitle: pullRequests.title,
      repoId: pullRequests.repoId,
    })
    .from(reviews)
    .innerJoin(pullRequests, eq(reviews.prId, pullRequests.id))
    .where(and(eq(reviews.reviewer, login), lt(reviews.submittedAt, before)))
    .orderBy(desc(reviews.submittedAt))
    .limit(limit);

  // Commits
  const commitRows = await db
    .select({
      sha: commits.sha,
      message: commits.message,
      additions: commits.additions,
      deletions: commits.deletions,
      repoId: commits.repoId,
      at: commits.committedAt,
    })
    .from(commits)
    .where(and(eq(commits.authorLogin, login), lt(commits.committedAt, before)))
    .orderBy(desc(commits.committedAt))
    .limit(limit);

  // Issues opened
  const issueOpenRows = await db
    .select({
      id: issues.id,
      number: issues.number,
      title: issues.title,
      bodyExcerpt: issues.bodyExcerpt,
      repoId: issues.repoId,
      at: issues.createdAt,
    })
    .from(issues)
    .where(and(eq(issues.author, login), lt(issues.createdAt, before)))
    .orderBy(desc(issues.createdAt))
    .limit(limit);

  // Issues closed (by author — we don't track closer separately)
  const issueCloseRows = await db
    .select({
      id: issues.id,
      number: issues.number,
      title: issues.title,
      bodyExcerpt: issues.bodyExcerpt,
      repoId: issues.repoId,
      at: issues.closedAt,
    })
    .from(issues)
    .where(
      and(
        eq(issues.author, login),
        isNotNull(issues.closedAt),
        lt(issues.closedAt, before),
      ),
    )
    .orderBy(desc(issues.closedAt))
    .limit(limit);

  const events: ActivityEvent[] = [];

  for (const r of prOpenRows) {
    const repo = repoMap.get(r.repoId) ?? "unknown";
    events.push({
      id: `pro-${r.id}`,
      at: r.at,
      kind: "pr_opened",
      repo,
      ref: `PR #${r.number}`,
      title: r.title ?? `Pull request #${r.number}`,
      body: r.bodyExcerpt,
      additions: r.additions,
      deletions: r.deletions,
      url: `${REPO_PREFIX}/${repo}/pull/${r.number}`,
    });
  }
  for (const r of prMergeRows) {
    const repo = repoMap.get(r.repoId) ?? "unknown";
    events.push({
      id: `prm-${r.id}`,
      at: r.at!,
      kind: "pr_merged",
      repo,
      ref: `PR #${r.number}`,
      title: r.title ?? `Pull request #${r.number}`,
      body: r.bodyExcerpt,
      additions: r.additions,
      deletions: r.deletions,
      url: `${REPO_PREFIX}/${repo}/pull/${r.number}`,
    });
  }
  for (const r of prCloseRows) {
    if (r.mergedAt) continue;
    const repo = repoMap.get(r.repoId) ?? "unknown";
    events.push({
      id: `prc-${r.id}`,
      at: r.at!,
      kind: "pr_closed",
      repo,
      ref: `PR #${r.number}`,
      title: r.title ?? `Pull request #${r.number}`,
      body: r.bodyExcerpt,
      additions: r.additions,
      deletions: r.deletions,
      url: `${REPO_PREFIX}/${repo}/pull/${r.number}`,
    });
  }
  for (const r of reviewRows) {
    const repo = repoMap.get(r.repoId) ?? "unknown";
    const kind: ActivityKind =
      r.state === "approved"
        ? "review_approved"
        : r.state === "changes_requested"
          ? "review_changes_requested"
          : "review_commented";
    events.push({
      id: `rv-${r.id}`,
      at: r.at,
      kind,
      repo,
      ref: `PR #${r.number}`,
      title: r.prTitle ?? `Pull request #${r.number}`,
      body: r.bodyExcerpt,
      url: `${REPO_PREFIX}/${repo}/pull/${r.number}#pullrequestreview-${r.id}`,
    });
  }
  for (const r of commitRows) {
    const repo = repoMap.get(r.repoId) ?? "unknown";
    // First line of the commit message is the subject; the rest goes in body.
    const message = r.message ?? "";
    const newlineIdx = message.indexOf("\n");
    const subject = newlineIdx === -1 ? message : message.slice(0, newlineIdx);
    const rest =
      newlineIdx === -1 ? null : message.slice(newlineIdx + 1).trim() || null;
    events.push({
      id: `co-${r.sha}`,
      at: r.at,
      kind: "commit",
      repo,
      ref: r.sha.slice(0, 7),
      title: subject || `Commit ${r.sha.slice(0, 7)}`,
      body: rest,
      additions: r.additions,
      deletions: r.deletions,
      url: `${REPO_PREFIX}/${repo}/commit/${r.sha}`,
    });
  }
  for (const r of issueOpenRows) {
    const repo = repoMap.get(r.repoId) ?? "unknown";
    events.push({
      id: `io-${r.id}`,
      at: r.at,
      kind: "issue_opened",
      repo,
      ref: `Issue #${r.number}`,
      title: r.title ?? `Issue #${r.number}`,
      body: r.bodyExcerpt,
      url: `${REPO_PREFIX}/${repo}/issues/${r.number}`,
    });
  }
  for (const r of issueCloseRows) {
    const repo = repoMap.get(r.repoId) ?? "unknown";
    events.push({
      id: `ic-${r.id}`,
      at: r.at!,
      kind: "issue_closed",
      repo,
      ref: `Issue #${r.number}`,
      title: r.title ?? `Issue #${r.number}`,
      body: r.bodyExcerpt,
      url: `${REPO_PREFIX}/${repo}/issues/${r.number}`,
    });
  }

  // Merge-sort desc, slice to limit. Cursor for next page = last event's `at`.
  events.sort((a, b) => b.at - a.at);
  return events.slice(0, limit);
}
