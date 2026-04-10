import { cookies } from "next/headers";
import { sign, verify } from "./signing";

export const SESSION_COOKIE = "gs_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export type SessionRecord = {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: number;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function b64urlDecode(input: string): string {
  // Pad to a multiple of 4.
  const padded = input + "===".slice((input.length + 3) % 4);
  return Buffer.from(
    padded.replaceAll("-", "+").replaceAll("_", "/"),
    "base64",
  ).toString("utf8");
}

/**
 * Creates a stateless, HMAC-signed session cookie. No DB lookup required
 * on subsequent requests — the signature is verified and the record is
 * decoded directly from the cookie value.
 */
export async function createSession(record: SessionRecord): Promise<void> {
  const payload = b64urlEncode(JSON.stringify(record));
  const signed = await sign(payload, getSecret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSession(): Promise<SessionRecord | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  let payload: string | null;
  try {
    payload = await verify(raw, getSecret());
  } catch {
    return null;
  }
  if (!payload) return null;
  try {
    const rec = JSON.parse(b64urlDecode(payload)) as SessionRecord;
    // Enforce TTL server-side even though the cookie has its own maxAge —
    // cookies can be replayed if they leak, so we double-check.
    if (Math.floor(Date.now() / 1000) - rec.createdAt > SESSION_TTL_SECONDS) {
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Org membership is enforced at login time in /api/auth/callback; once a
 * session cookie exists, trust it for its TTL. Pages/layouts call this and
 * redirect on null.
 */
export async function getAuthorizedSession(): Promise<SessionRecord | null> {
  return getSession();
}
