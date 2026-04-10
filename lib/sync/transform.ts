// Pure transformations from GitHub API shapes to our DB row shapes.
// No DB access here — keeps these unit-testable.
import type {
  GhCommit,
  GhIssue,
  GhPullRequest,
  GhRepo,
  GhReview,
} from "@/lib/github";
import type {
  NewCommit,
  NewIssue,
  NewPullRequest,
  NewRepo,
  NewReview,
  NewUser,
} from "@/lib/db/schema";

const isoToEpoch = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  return Math.floor(new Date(iso).getTime() / 1000);
};

const MAX_EXCERPT = 600;
function excerpt(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > MAX_EXCERPT
    ? trimmed.slice(0, MAX_EXCERPT) + "…"
    : trimmed;
}

export function repoFromGh(gh: GhRepo): NewRepo {
  return {
    id: gh.databaseId,
    name: gh.nameWithOwner,
    defaultBranch: gh.defaultBranchRef?.name ?? "main",
    createdAt: isoToEpoch(gh.createdAt)!,
    archived: gh.isArchived,
  };
}

export function userStub(login: string): NewUser {
  return { login, name: null, avatarUrl: null };
}

export function prFromGh(
  gh: GhPullRequest,
  repoId: number,
): { pr: NewPullRequest; reviews: NewReview[]; logins: string[] } {
  const author = gh.author?.login ?? "ghost";
  const firstReviewAt = pickFirstReviewAt(gh.reviews?.nodes ?? []);
  const pr: NewPullRequest = {
    id: gh.databaseId,
    repoId,
    number: gh.number,
    title: gh.title ?? null,
    bodyExcerpt: excerpt(gh.body),
    author,
    state: gh.state === "MERGED" ? "merged" : gh.state === "CLOSED" ? "closed" : "open",
    createdAt: isoToEpoch(gh.createdAt)!,
    mergedAt: isoToEpoch(gh.mergedAt),
    closedAt: isoToEpoch(gh.closedAt),
    firstReviewAt,
    additions: gh.additions ?? 0,
    deletions: gh.deletions ?? 0,
  };
  const reviews: NewReview[] = [];
  const logins = new Set<string>([author]);
  for (const r of gh.reviews?.nodes ?? []) {
    if (!r.submittedAt || !r.author?.login) continue;
    if (r.state === "PENDING") continue;
    reviews.push({
      id: r.databaseId,
      prId: gh.databaseId,
      reviewer: r.author.login,
      state: mapReviewState(r.state),
      bodyExcerpt: excerpt(r.body),
      submittedAt: isoToEpoch(r.submittedAt)!,
    });
    logins.add(r.author.login);
  }
  return { pr, reviews, logins: Array.from(logins) };
}

function mapReviewState(s: GhReview["state"]): NewReview["state"] {
  switch (s) {
    case "APPROVED":
      return "approved";
    case "CHANGES_REQUESTED":
      return "changes_requested";
    case "COMMENTED":
      return "commented";
    case "DISMISSED":
      return "dismissed";
    default:
      return "commented";
  }
}

export function pickFirstReviewAt(reviews: GhReview[]): number | null {
  let min: number | null = null;
  for (const r of reviews) {
    if (!r.submittedAt) continue;
    if (r.state === "PENDING") continue;
    const t = isoToEpoch(r.submittedAt)!;
    if (min === null || t < min) min = t;
  }
  return min;
}

export function issueFromGh(
  gh: GhIssue,
  repoId: number,
): { issue: NewIssue; logins: string[] } {
  const author = gh.author?.login ?? "ghost";
  return {
    issue: {
      id: gh.databaseId,
      repoId,
      number: gh.number,
      title: gh.title ?? null,
      bodyExcerpt: excerpt(gh.body),
      author,
      state: gh.state === "CLOSED" ? "closed" : "open",
      createdAt: isoToEpoch(gh.createdAt)!,
      closedAt: isoToEpoch(gh.closedAt),
    },
    logins: [author],
  };
}

export function commitFromGh(
  gh: GhCommit,
  repoId: number,
): { commit: NewCommit; logins: string[] } {
  const login = gh.author?.login ?? null;
  const date = gh.commit.committer?.date ?? gh.commit.author?.date ?? null;
  // Commit messages: first line is the subject, the rest is body. Keep
  // a short excerpt that includes the subject and a hint of any body.
  const message = excerpt(gh.commit.message);
  return {
    commit: {
      sha: gh.sha,
      repoId,
      authorLogin: login,
      message,
      committedAt: date ? isoToEpoch(date)! : 0,
      additions: gh.stats?.additions ?? 0,
      deletions: gh.stats?.deletions ?? 0,
    },
    logins: login ? [login] : [],
  };
}
