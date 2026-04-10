import Link from "next/link";
import { getDb } from "@/lib/db/client";
import {
  getActivityHeatmap,
  getPrTimings,
  getUserActivity,
  getUserMetrics,
} from "@/lib/db/queries";
import {
  cycleTime,
  deltaPercent,
  previousRange,
  rangeForGranularity,
  timeToFirstReview,
  type Granularity,
} from "@/lib/metrics";
import { StatRow } from "@/components/StatRow";
import { RangeSelector } from "@/components/RangeSelector";
import { ActivityChart } from "@/components/ActivityChart";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { formatDuration, formatNumber } from "@/lib/format";

type Props = {
  params: Promise<{ login: string }>;
  searchParams: Promise<{ range?: string }>;
};

const VALID: Granularity[] = ["day", "week", "month"];

const RANGE_LABEL: Record<Granularity, string> = {
  day: "last 24 hours",
  week: "last 7 days",
  month: "last 30 days",
  custom: "custom range",
};

export default async function MemberPage({ params, searchParams }: Props) {
  const { login } = await params;
  const { range: rangeParam } = await searchParams;
  const granularity: Granularity = (VALID as string[]).includes(rangeParam ?? "")
    ? (rangeParam as Granularity)
    : "month";

  const db = await getDb();
  const range = rangeForGranularity(granularity);
  const prev = previousRange(range);

  const [metrics, prevMetrics, heatmap, timings, initialActivity] =
    await Promise.all([
      getUserMetrics(db, login, range),
      getUserMetrics(db, login, prev),
      getActivityHeatmap(db, range, login),
      getPrTimings(db, range, login),
      getUserActivity(db, login, { limit: 30 }),
    ]);

  const ttfr = timeToFirstReview(timings);
  const cycle = cycleTime(timings);
  const initialCursor =
    initialActivity.length === 30
      ? initialActivity[initialActivity.length - 1].at
      : null;

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-12">
      {/* Page header */}
      <header className="border-b border-rule pb-8">
        <Link
          href={`/overview?range=${granularity}`}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute hover:text-accent transition-colors"
        >
          ← Overview
        </Link>
        <div className="mt-4 flex items-end justify-between gap-8">
          <div>
            <h1 className="font-display text-6xl leading-[0.95] text-ink italic">
              {login}
            </h1>
            <p className="mt-4 font-sans text-sm text-ink-soft max-w-xl">
              Individual contribution snapshot for the{" "}
              {RANGE_LABEL[granularity]}, scoped to all repositories.
            </p>
          </div>
          <RangeSelector />
        </div>
      </header>

      {/* Sidebar + Timeline */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-12">
        {/* LEFT — sticky sidebar */}
        <aside className="lg:sticky lg:top-8 lg:self-start space-y-8">
          <div>
            <RailLabel>Throughput</RailLabel>
            <div className="mt-3 border border-rule bg-paper-soft/40 px-4">
              <StatRow
                label="PRs merged"
                value={formatNumber(metrics.prsMerged)}
                deltaPct={deltaPercent(
                  metrics.prsMerged,
                  prevMetrics.prsMerged,
                )}
              />
              <StatRow
                label="PRs opened"
                value={formatNumber(metrics.prsOpened)}
                deltaPct={deltaPercent(
                  metrics.prsOpened,
                  prevMetrics.prsOpened,
                )}
              />
              <StatRow
                label="Reviews given"
                value={formatNumber(metrics.reviews)}
                deltaPct={deltaPercent(metrics.reviews, prevMetrics.reviews)}
              />
              <StatRow
                label="Commits"
                value={formatNumber(metrics.commits)}
                deltaPct={deltaPercent(metrics.commits, prevMetrics.commits)}
              />
            </div>
          </div>

          <div>
            <RailLabel>Review health</RailLabel>
            <div className="mt-3 border border-rule bg-paper-soft/40 px-4">
              <StatRow
                label="Time to first review"
                value={formatDuration(ttfr.medianSeconds)}
                hint={`p90 ${formatDuration(ttfr.p90Seconds)} · n=${ttfr.count}`}
              />
              <StatRow
                label="Cycle time"
                value={formatDuration(cycle.medianSeconds)}
                hint={`p90 ${formatDuration(cycle.p90Seconds)} · n=${cycle.count}`}
              />
              <StatRow
                label="Issues opened"
                value={formatNumber(metrics.issuesOpened)}
                deltaPct={deltaPercent(
                  metrics.issuesOpened,
                  prevMetrics.issuesOpened,
                )}
              />
              <StatRow
                label="Issues closed"
                value={formatNumber(metrics.issuesClosed)}
                deltaPct={deltaPercent(
                  metrics.issuesClosed,
                  prevMetrics.issuesClosed,
                )}
              />
            </div>
          </div>

          <div>
            <RailLabel>Daily pulse</RailLabel>
            <div className="mt-3 border border-rule bg-paper-soft/40 p-4">
              <ActivityChart data={heatmap} />
            </div>
          </div>
        </aside>

        {/* RIGHT — timeline */}
        <div>
          <div className="flex items-baseline justify-between mb-6">
            <RailLabel>Activity timeline</RailLabel>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Newest first · click ↗ to open
            </span>
          </div>
          <ActivityTimeline
            login={login}
            initialEvents={initialActivity}
            initialCursor={initialCursor}
          />
        </div>
      </div>
    </div>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
      {children}
    </div>
  );
}
