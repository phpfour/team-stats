import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function GET(request: Request) {
  // Allow GET for convenience from a link.
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url));
}
