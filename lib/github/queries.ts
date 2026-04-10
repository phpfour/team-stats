// GraphQL queries + paginated fetchers for the resources we sync.
import type { GithubClient } from "./client";

// ---------- Repositories ----------

export type GhRepo = {
  databaseId: number;
  nameWithOwner: string;
  defaultBranchRef: { name: string } | null;
  createdAt: string;
  isArchived: boolean;
};

const LIST_REPOS_QUERY = /* GraphQL */ `
  query ListRepos($org: String!, $cursor: String) {
    organization(login: $org) {
      repositories(
        first: 100
        after: $cursor
        orderBy: { field: CREATED_AT, direction: ASC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          databaseId
          nameWithOwner
          defaultBranchRef {
            name
          }
          createdAt
          isArchived
        }
      }
    }
  }
`;

type ListReposData = {
  organization: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: GhRepo[];
    };
  };
};

export async function* listOrgRepos(
  client: GithubClient,
  org: string,
): AsyncGenerator<GhRepo> {
  let cursor: string | null = null;
  while (true) {
    const data: ListReposData = await client.graphql<ListReposData>(
      LIST_REPOS_QUERY,
      { org, cursor },
    );
    for (const node of data.organization.repositories.nodes) {
      yield node;
    }
    if (!data.organization.repositories.pageInfo.hasNextPage) return;
    cursor = data.organization.repositories.pageInfo.endCursor;
  }
}

// ---------- Pull Requests + Reviews ----------

export type GhReview = {
  databaseId: number;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  submittedAt: string | null;
  body: string | null;
  author: { login: string } | null;
};

export type GhPullRequest = {
  databaseId: number;
  number: number;
  title: string;
  body: string | null;
  author: { login: string } | null;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  reviews: { nodes: GhReview[] };
};

const LIST_PRS_QUERY = /* GraphQL */ `
  query ListPRs($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(
        first: 50
        after: $cursor
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          databaseId
          number
          title
          body
          author {
            login
          }
          state
          createdAt
          mergedAt
          closedAt
          additions
          deletions
          updatedAt
          reviews(first: 100) {
            nodes {
              databaseId
              state
              submittedAt
              body
              author {
                login
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Yields PRs newest-updated first. Caller stops once it sees a PR older than
 * its incremental cursor (`updatedAt`). For backfill, just consume to exhaustion.
 */
type ListPRsData = {
  repository: {
    pullRequests: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: Array<GhPullRequest & { updatedAt: string }>;
    };
  };
};

export async function* listRepoPullRequests(
  client: GithubClient,
  ownerName: string, // "klasio/api"
): AsyncGenerator<GhPullRequest & { updatedAt: string }> {
  for await (const page of listRepoPullRequestsPages(client, ownerName)) {
    for (const node of page) yield node;
  }
}

/** Paged variant — yields one GraphQL page at a time for batched writes. */
export async function* listRepoPullRequestsPages(
  client: GithubClient,
  ownerName: string,
): AsyncGenerator<Array<GhPullRequest & { updatedAt: string }>> {
  const [owner, name] = ownerName.split("/");
  let cursor: string | null = null;
  while (true) {
    const data: ListPRsData = await client.graphql<ListPRsData>(LIST_PRS_QUERY, {
      owner,
      name,
      cursor,
    });
    yield data.repository.pullRequests.nodes;
    if (!data.repository.pullRequests.pageInfo.hasNextPage) return;
    cursor = data.repository.pullRequests.pageInfo.endCursor;
  }
}

// ---------- Issues ----------

export type GhIssue = {
  databaseId: number;
  number: number;
  title: string;
  body: string | null;
  author: { login: string } | null;
  state: "OPEN" | "CLOSED";
  createdAt: string;
  closedAt: string | null;
  updatedAt: string;
};

const LIST_ISSUES_QUERY = /* GraphQL */ `
  query ListIssues($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      issues(
        first: 100
        after: $cursor
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          databaseId
          number
          title
          body
          author {
            login
          }
          state
          createdAt
          closedAt
          updatedAt
        }
      }
    }
  }
`;

type ListIssuesData = {
  repository: {
    issues: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: GhIssue[];
    };
  };
};

export async function* listRepoIssues(
  client: GithubClient,
  ownerName: string,
): AsyncGenerator<GhIssue> {
  for await (const page of listRepoIssuesPages(client, ownerName)) {
    for (const node of page) yield node;
  }
}

export async function* listRepoIssuesPages(
  client: GithubClient,
  ownerName: string,
): AsyncGenerator<GhIssue[]> {
  const [owner, name] = ownerName.split("/");
  let cursor: string | null = null;
  while (true) {
    const data: ListIssuesData = await client.graphql<ListIssuesData>(
      LIST_ISSUES_QUERY,
      { owner, name, cursor },
    );
    yield data.repository.issues.nodes;
    if (!data.repository.issues.pageInfo.hasNextPage) return;
    cursor = data.repository.issues.pageInfo.endCursor;
  }
}

// ---------- Commits ----------
//
// Use REST for commits — GraphQL's history requires a branch ref and is more
// awkward for "all commits since X". REST /repos/{owner}/{repo}/commits with
// `since` param is purpose-built for this.

export type GhCommit = {
  sha: string;
  commit: {
    author: { name: string; email: string; date: string } | null;
    committer: { date: string } | null;
    message: string;
  };
  author: { login: string } | null;
  stats?: { additions: number; deletions: number };
};

export async function* listRepoCommits(
  client: GithubClient,
  ownerName: string,
  since?: string, // ISO timestamp
): AsyncGenerator<GhCommit> {
  for await (const page of listRepoCommitsPages(client, ownerName, since)) {
    for (const c of page) yield c;
  }
}

export async function* listRepoCommitsPages(
  client: GithubClient,
  ownerName: string,
  since?: string,
): AsyncGenerator<GhCommit[]> {
  let page = 1;
  while (true) {
    const params = new URLSearchParams({
      per_page: "100",
      page: String(page),
    });
    if (since) params.set("since", since);
    const path = `/repos/${ownerName}/commits?${params.toString()}`;
    const batch = await client.rest<GhCommit[]>(path);
    if (batch.length === 0) return;
    yield batch;
    if (batch.length < 100) return;
    page++;
  }
}
