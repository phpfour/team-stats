// GitHub OAuth flow primitives. Pure-ish — takes env values explicitly so
// these can be tested without faking getCloudflareContext().

export type GithubUser = {
  login: string;
  name: string | null;
  avatar_url: string | null;
};

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("state", opts.state);
  url.searchParams.set("scope", opts.scope ?? "read:user read:org repo");
  return url.toString();
}

export async function exchangeCodeForToken(opts: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      code: opts.code,
      redirect_uri: opts.redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(`token exchange returned no token: ${data.error ?? "?"}`);
  }
  return data.access_token;
}

export async function fetchGithubUser(token: string): Promise<GithubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "github-stats",
    },
  });
  if (!res.ok) throw new Error(`github /user failed: ${res.status}`);
  return (await res.json()) as GithubUser;
}

/**
 * Returns true if the user that owns `token` is an active member of `org`.
 * Uses GET /user/memberships/orgs/{org} which requires the `read:org` scope.
 * - 200 + state=active → member
 * - 200 + state=pending → invited but not yet active → treat as not a member
 * - 404 → not a member
 * - 403 → scope missing
 */
export async function isOrgMember(
  token: string,
  org: string,
): Promise<boolean> {
  const res = await fetch(
    `https://api.github.com/user/memberships/orgs/${encodeURIComponent(org)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "github-stats",
      },
    },
  );
  if (res.status === 404) return false;
  if (!res.ok) {
    throw new Error(`github membership check failed: ${res.status}`);
  }
  const data = (await res.json()) as { state?: string };
  return data.state === "active";
}
