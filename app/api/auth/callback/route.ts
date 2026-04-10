import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForToken,
  fetchGithubUser,
  isOrgMember,
} from "@/lib/auth/oauth";
import { verify } from "@/lib/auth/signing";
import { createSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const STATE_COOKIE = "gs_oauth_state";

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  const org = process.env.GITHUB_ORG;
  if (!clientId || !clientSecret || !sessionSecret || !org) {
    return new NextResponse("OAuth not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=missing_params", url));
  }

  const jar = await cookies();
  const signedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  if (!signedState) {
    return NextResponse.redirect(new URL("/login?error=missing_state", url));
  }
  const verified = await verify(signedState, sessionSecret);
  if (verified !== state) {
    return NextResponse.redirect(new URL("/login?error=bad_state", url));
  }

  let token: string;
  let user: Awaited<ReturnType<typeof fetchGithubUser>>;
  try {
    token = await exchangeCodeForToken({
      clientId,
      clientSecret,
      code,
      redirectUri: `${url.origin}/api/auth/callback`,
    });
    user = await fetchGithubUser(token);
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", url));
  }

  // Org membership gate.
  try {
    const isMember = await isOrgMember(token, org);
    if (!isMember) {
      return NextResponse.redirect(new URL("/login?error=not_authorized", url));
    }
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", url));
  }

  await createSession({
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    createdAt: Math.floor(Date.now() / 1000),
  });

  return NextResponse.redirect(new URL("/overview", url));
}
