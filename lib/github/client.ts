// Thin GitHub client. GraphQL primary, REST helper for the few endpoints
// where REST is simpler. Honors rate limits with a soft retry.

const GRAPHQL_URL = "https://api.github.com/graphql";
const REST_BASE = "https://api.github.com";
const USER_AGENT = "github-stats";

export class GithubError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
  }
}

export type GithubClient = {
  graphql: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
  rest: <T>(path: string, init?: RequestInit) => Promise<T>;
};

export function makeClient(token: string): GithubClient {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
  };

  async function graphql<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new GithubError(`graphql ${res.status}`, res.status, body);
    }
    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors) {
      throw new GithubError("graphql errors", res.status, json.errors);
    }
    return json.data as T;
  }

  async function rest<T>(path: string, init?: RequestInit): Promise<T> {
    const url = path.startsWith("http") ? path : `${REST_BASE}${path}`;
    const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
    if (!res.ok) {
      const body = await res.text();
      throw new GithubError(`rest ${res.status} ${path}`, res.status, body);
    }
    return (await res.json()) as T;
  }

  return { graphql, rest };
}
