import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthorizedSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthorizedSession();
  if (!session) redirect("/login");

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <header className="border-b border-rule">
        <div className="mx-auto max-w-[1200px] px-8 h-16 flex items-center justify-between">
          <Link href="/overview" className="flex items-baseline gap-3 group">
            <span className="font-display text-2xl text-ink leading-none italic">
              Team Stats
            </span>
          </Link>
          <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-wider">
            <span className="text-ink-mute">
              Signed in as <span className="text-ink">{session.login}</span>
            </span>
            <a
              href="/api/auth/logout"
              className="text-ink-mute hover:text-accent transition-colors"
            >
              Sign out
            </a>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-rule">
        <div className="mx-auto max-w-[1200px] px-8 py-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          <span>team stats · engineering analytics</span>
          <span>synced every 15 minutes</span>
        </div>
      </footer>
    </div>
  );
}
