import Link from "next/link";
import { getDb } from "@/lib/db/client";
import {
  getActivityHeatmap,
  getOrgMetrics,
  getPrTimings,
  getTopContributors,
} from "@/lib/db/queries";
import {
  cycleTime,
  deltaPercent,
  previousRange,
  rangeForGranularity,
  timeToFirstReview,
  type Granularity,
} from "@/lib/metrics";
import { KpiCard } from "@/components/KpiCard";
import { RangeSelector } from "@/components/RangeSelector";
import { ActivityChart } from "@/components/ActivityChart";
import { formatDuration, formatNumber } from "@/lib/format";

type Props = {
  searchParams: Promise<{ range?: string }>;
};

const VALID: Granularity[] = ["day", "week", "month"];

const RANGE_LABEL: Record<Granularity, string> = {
  day: "last 24 hours",
  week: "last 7 days",
  month: "last 30 days",
  custom: "custom range",
};

export default async function OverviewPage({ searchParams }: Props) {
  const { range: rangeParam } = await searchParams;
  const granularity: Granularity =
    (VALID as string[]).includes(rangeParam ?? "")
      ? (rangeParam as Granularity)
      : "month";

  const db = await getDb();
  const range = rangeForGranularity(granularity);
  const prev = previousRange(range);

  const [metrics, prevMetrics, contributors, heatmap, timings] = await Promise.all([
    getOrgMetrics(db, range),
    getOrgMetrics(db, prev),
    getTopContributors(db, range, 10),
    getActivityHeatmap(db, range),
    getPrTimings(db, range),
  ]);

  const ttfr = timeToFirstReview(timings);
  const cycle = cycleTime(timings);

  const totalActivity =
    metrics.prsOpened + metrics.prsMerged + metrics.reviews + metrics.commits;

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-12">
      {/* Masthead */}
      <header className="flex items-end justify-between gap-8 border-b border-rule pb-8">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            Engineering overview
          </div>
          <h1 className="mt-3 font-display text-6xl leading-[0.95] text-ink">
            The Monday <em className="italic">briefing</em>.
          </h1>
          <p className="mt-4 font-sans text-sm text-ink-soft max-w-xl">
            A read on shipping velocity, review health, and contributor focus
            across all repositories for the {RANGE_LABEL[granularity]}.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <RangeSelector />
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint tabular">
            {formatNumber(totalActivity)} total events
          </div>
        </div>
      </header>

      {/* Throughput band */}
      <section className="mt-12">
        <SectionTitle index="01" title="Throughput" />
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 border-l border-r border-b border-rule">
          <KpiCard
            label="PRs merged"
            value={formatNumber(metrics.prsMerged)}
            deltaPct={deltaPercent(metrics.prsMerged, prevMetrics.prsMerged)}
            hint="vs previous period"
          />
          <KpiCard
            label="PRs opened"
            value={formatNumber(metrics.prsOpened)}
            deltaPct={deltaPercent(metrics.prsOpened, prevMetrics.prsOpened)}
            hint="vs previous"
          />
          <KpiCard
            label="Reviews"
            value={formatNumber(metrics.reviews)}
            deltaPct={deltaPercent(metrics.reviews, prevMetrics.reviews)}
            hint="vs previous"
          />
          <KpiCard
            label="Commits"
            value={formatNumber(metrics.commits)}
            deltaPct={deltaPercent(metrics.commits, prevMetrics.commits)}
            hint="vs previous"
          />
        </div>
      </section>

      {/* Review health band */}
      <section className="mt-12">
        <SectionTitle index="02" title="Review health" />
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 border-l border-r border-b border-rule">
          <KpiCard
            label="Time to first review"
            value={formatDuration(ttfr.medianSeconds)}
            hint={`p90 ${formatDuration(ttfr.p90Seconds)} · n=${ttfr.count}`}
          />
          <KpiCard
            label="Cycle time"
            value={formatDuration(cycle.medianSeconds)}
            hint={`p90 ${formatDuration(cycle.p90Seconds)} · n=${cycle.count}`}
          />
          <KpiCard
            label="Issues opened"
            value={formatNumber(metrics.issuesOpened)}
            deltaPct={deltaPercent(metrics.issuesOpened, prevMetrics.issuesOpened)}
            hint="vs previous"
          />
          <KpiCard
            label="Issues closed"
            value={formatNumber(metrics.issuesClosed)}
            deltaPct={deltaPercent(metrics.issuesClosed, prevMetrics.issuesClosed)}
            hint="vs previous"
          />
        </div>
      </section>

      {/* Activity + Contributors */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <SectionTitle index="03" title="Daily pulse" />
          <div className="mt-5 border border-rule bg-paper-soft/30 p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-sans text-base font-semibold text-ink">
                Activity by day
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                PRs · reviews · commits
              </span>
            </div>
            <ActivityChart data={heatmap} />
          </div>
        </div>

        <div className="lg:col-span-2">
          <SectionTitle index="04" title="Contributors" />
          <div className="mt-5 border border-rule bg-paper-soft/30">
            <div className="px-6 pt-5 pb-3 flex items-baseline justify-between">
              <h3 className="font-sans text-base font-semibold text-ink">Top ten</h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                ranked by total
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-wider text-ink-mute border-y border-rule">
                  <th className="text-left font-normal px-6 py-2">#</th>
                  <th className="text-left font-normal py-2">User</th>
                  <th className="text-right font-normal py-2 tabular">PR</th>
                  <th className="text-right font-normal py-2 tabular">RV</th>
                  <th className="text-right font-normal px-6 py-2 tabular">CO</th>
                </tr>
              </thead>
              <tbody>
                {contributors.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center font-mono text-[11px] uppercase tracking-wider text-ink-faint"
                    >
                      No contributors in this range
                    </td>
                  </tr>
                ) : (
                  contributors.map((c, i) => (
                    <tr
                      key={c.login}
                      className="border-b border-rule-soft last:border-0 hover:bg-paper-sunk/40 transition-colors"
                    >
                      <td className="px-6 py-3 font-mono text-[11px] text-ink-faint tabular">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/members/${c.login}?range=${granularity}`}
                          className="font-sans text-sm font-medium text-ink hover:text-accent transition-colors"
                        >
                          {c.login}
                        </Link>
                      </td>
                      <td className="py-3 text-right font-mono text-xs text-ink-soft tabular">
                        {c.prs}
                      </td>
                      <td className="py-3 text-right font-mono text-xs text-ink-soft tabular">
                        {c.reviews}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs text-ink-soft tabular">
                        {c.commits}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
      {title}
    </div>
  );
}
