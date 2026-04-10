export { makeClient, GithubError } from "./client";
export type { GithubClient } from "./client";
export {
  listOrgRepos,
  listRepoPullRequests,
  listRepoPullRequestsPages,
  listRepoIssues,
  listRepoIssuesPages,
  listRepoCommits,
  listRepoCommitsPages,
} from "./queries";
export type {
  GhRepo,
  GhPullRequest,
  GhReview,
  GhIssue,
  GhCommit,
} from "./queries";
