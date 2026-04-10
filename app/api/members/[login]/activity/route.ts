import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getUserActivity } from "@/lib/db/queries";
import { getAuthorizedSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const session = await getAuthorizedSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { login } = await params;
  const url = new URL(request.url);
  const beforeParam = url.searchParams.get("before");
  const limitParam = url.searchParams.get("limit");
  const before = beforeParam ? Number(beforeParam) : undefined;
  const limit = Math.min(Math.max(Number(limitParam ?? 30), 1), 100);

  const db = await getDb();
  const events = await getUserActivity(db, login, { before, limit });
  const nextCursor = events.length === limit ? events[events.length - 1].at : null;

  return NextResponse.json({ events, nextCursor });
}
