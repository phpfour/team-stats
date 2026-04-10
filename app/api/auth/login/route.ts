import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/auth/oauth";
import { sign } from "@/lib/auth/signing";

export const runtime = "nodejs";

const STATE_COOKIE = "gs_oauth_state";

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!clientId || !sessionSecret) {
    return new NextResponse("OAuth not configured", { status: 500 });
  }

  const origin = process.env.APP_URL || new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/callback`;
  const state = randomState();
  const signedState = await sign(state, sessionSecret);

  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
  });

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(STATE_COOKIE, signedState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return res;
}
