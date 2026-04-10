import { median, p90 } from "./percentile";

export type PrTimingRow = {
  createdAt: number;
  firstReviewAt: number | null;
  mergedAt: number | null;
};

export type TimingStats = {
  count: number;
  medianSeconds: number | null;
  p90Seconds: number | null;
};

/**
 * Time-to-first-review: seconds from PR creation to its first review.
 * PRs with no review are excluded from the sample.
 */
export function timeToFirstReview(rows: PrTimingRow[]): TimingStats {
  const samples: number[] = [];
  for (const r of rows) {
    if (r.firstReviewAt !== null && r.firstReviewAt >= r.createdAt) {
      samples.push(r.firstReviewAt - r.createdAt);
    }
  }
  return {
    count: samples.length,
    medianSeconds: median(samples),
    p90Seconds: p90(samples),
  };
}

/**
 * Cycle time: seconds from PR creation to merge. Closed-without-merge excluded.
 */
export function cycleTime(rows: PrTimingRow[]): TimingStats {
  const samples: number[] = [];
  for (const r of rows) {
    if (r.mergedAt !== null && r.mergedAt >= r.createdAt) {
      samples.push(r.mergedAt - r.createdAt);
    }
  }
  return {
    count: samples.length,
    medianSeconds: median(samples),
    p90Seconds: p90(samples),
  };
}
