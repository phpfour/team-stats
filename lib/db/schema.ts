import {
  bigint,
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

// All timestamps stored as Unix epoch seconds (INT) for cheap range queries.
// GitHub IDs use BIGINT — they can exceed 2^31 but stay well under 2^53 so we
// keep them as JS numbers via { mode: "number" }.

export const repos = mysqlTable("repos", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  defaultBranch: varchar("default_branch", { length: 255 }).notNull(),
  createdAt: int("created_at").notNull(),
  archived: boolean("archived").notNull().default(false),
});

export const users = mysqlTable("users", {
  login: varchar("login", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
});

export const pullRequests = mysqlTable(
  "pull_requests",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    repoId: bigint("repo_id", { mode: "number" })
      .notNull()
      .references(() => repos.id),
    number: int("number").notNull(),
    title: varchar("title", { length: 512 }),
    bodyExcerpt: text("body_excerpt"),
    author: varchar("author", { length: 64 })
      .notNull()
      .references(() => users.login),
    state: mysqlEnum("state", ["open", "merged", "closed"]).notNull(),
    createdAt: int("created_at").notNull(),
    mergedAt: int("merged_at"),
    closedAt: int("closed_at"),
    firstReviewAt: int("first_review_at"),
    additions: int("additions").notNull().default(0),
    deletions: int("deletions").notNull().default(0),
  },
  (t) => ({
    repoNumberIdx: index("pr_repo_number_idx").on(t.repoId, t.number),
    authorCreatedIdx: index("pr_author_created_idx").on(t.author, t.createdAt),
    createdIdx: index("pr_created_idx").on(t.createdAt),
    mergedIdx: index("pr_merged_idx").on(t.mergedAt),
  }),
);

export const reviews = mysqlTable(
  "reviews",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    prId: bigint("pr_id", { mode: "number" })
      .notNull()
      .references(() => pullRequests.id),
    reviewer: varchar("reviewer", { length: 64 })
      .notNull()
      .references(() => users.login),
    state: mysqlEnum("state", [
      "approved",
      "changes_requested",
      "commented",
      "dismissed",
    ]).notNull(),
    bodyExcerpt: text("body_excerpt"),
    submittedAt: int("submitted_at").notNull(),
  },
  (t) => ({
    prIdx: index("review_pr_idx").on(t.prId),
    reviewerSubmittedIdx: index("review_reviewer_submitted_idx").on(
      t.reviewer,
      t.submittedAt,
    ),
  }),
);

export const commits = mysqlTable(
  "commits",
  {
    sha: varchar("sha", { length: 40 }).primaryKey(),
    repoId: bigint("repo_id", { mode: "number" })
      .notNull()
      .references(() => repos.id),
    authorLogin: varchar("author_login", { length: 64 }).references(
      () => users.login,
    ),
    message: text("message"),
    committedAt: int("committed_at").notNull(),
    additions: int("additions").notNull().default(0),
    deletions: int("deletions").notNull().default(0),
  },
  (t) => ({
    repoCommittedIdx: index("commit_repo_committed_idx").on(
      t.repoId,
      t.committedAt,
    ),
    authorCommittedIdx: index("commit_author_committed_idx").on(
      t.authorLogin,
      t.committedAt,
    ),
  }),
);

export const issues = mysqlTable(
  "issues",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    repoId: bigint("repo_id", { mode: "number" })
      .notNull()
      .references(() => repos.id),
    number: int("number").notNull(),
    title: varchar("title", { length: 512 }),
    bodyExcerpt: text("body_excerpt"),
    author: varchar("author", { length: 64 })
      .notNull()
      .references(() => users.login),
    state: mysqlEnum("state", ["open", "closed"]).notNull(),
    createdAt: int("created_at").notNull(),
    closedAt: int("closed_at"),
  },
  (t) => ({
    repoNumberIdx: index("issue_repo_number_idx").on(t.repoId, t.number),
    createdIdx: index("issue_created_idx").on(t.createdAt),
  }),
);

export const syncState = mysqlTable(
  "sync_state",
  {
    resource: varchar("resource", { length: 64 }).notNull(),
    repoId: bigint("repo_id", { mode: "number" }).notNull(),
    lastCursor: text("last_cursor"),
    lastRunAt: int("last_run_at").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.resource, t.repoId] }),
  }),
);

export type Repo = typeof repos.$inferSelect;
export type NewRepo = typeof repos.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PullRequest = typeof pullRequests.$inferSelect;
export type NewPullRequest = typeof pullRequests.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type Commit = typeof commits.$inferSelect;
export type NewCommit = typeof commits.$inferInsert;
export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;
