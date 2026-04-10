type Props = {
  searchParams: Promise<{ error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized: "Your account is not authorized to access this dashboard.",
  bad_state: "Login session expired or was tampered with. Please try again.",
  missing_state: "Login session expired. Please try again.",
  missing_params: "OAuth callback was missing required parameters.",
  oauth_failed: "Authorization failed. Please try again.",
};

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const message = error ? ERROR_MESSAGES[error] ?? "Login failed." : null;

  return (
    <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-5">
      {/* Editorial column */}
      <aside className="hidden lg:flex lg:col-span-3 border-r border-rule bg-paper-soft/40 p-16 flex-col justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          Team Stats
        </div>

        <div className="max-w-xl">
          <h1 className="font-display text-7xl leading-[0.92] text-ink">
            Engineering, <em className="italic">measured</em>.
          </h1>
          <p className="mt-8 font-sans text-base text-ink-soft leading-relaxed">
            A weekly briefing on shipping velocity, review health, and the
            people doing the work. Built for the CTO who&apos;d rather read one
            page on Monday morning than swim through dashboards all week.
          </p>
        </div>

        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint flex items-center justify-between">
          <span>Restricted access</span>
          <span>Allowlist enforced</span>
        </div>
      </aside>

      {/* Sign-in column */}
      <section className="lg:col-span-2 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute">
            Authentication required
          </div>
          <h2 className="mt-3 font-display text-4xl text-ink leading-tight">
            Sign in to continue.
          </h2>
          <p className="mt-3 font-sans text-sm text-ink-soft">
            Sign in with your organization account to continue.
          </p>

          {message ? (
            <div className="mt-6 border-l-2 border-accent bg-accent-bg/40 px-4 py-3 font-mono text-[11px] text-negative">
              {message}
            </div>
          ) : null}

          <a
            href="/api/auth/login"
            className="mt-8 group inline-flex w-full items-center justify-between border border-ink bg-ink px-5 py-4 text-paper transition-colors hover:bg-accent hover:border-accent"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
              Sign in
            </span>
            <span className="font-display text-xl italic transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>

          <div className="mt-10 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Team Stats · {new Date().getFullYear()}
          </div>
        </div>
      </section>
    </div>
  );
}
