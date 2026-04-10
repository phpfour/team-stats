import { describe, it, expect } from "vitest";
import { median, p90, percentile } from "./percentile";
import { cycleTime, timeToFirstReview, type PrTimingRow } from "./timings";
import {
  deltaPercent,
  previousRange,
  rangeForGranularity,
} from "./range";

describe("percentile", () => {
  it("returns null for empty", () => {
    expect(median([])).toBeNull();
    expect(p90([])).toBeNull();
  });

  it("returns the only value for length 1", () => {
    expect(median([42])).toBe(42);
    expect(p90([42])).toBe(42);
  });

  it("median of [1..9] is 5", () => {
    expect(median([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(5);
  });

  it("p90 of [1..10] is 9.1 (linear interp)", () => {
    expect(p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeCloseTo(9.1);
  });

  it("clamps p outside [0,1]", () => {
    const sorted = [1, 2, 3];
    expect(percentile(sorted, -1)).toBe(1);
    expect(percentile(sorted, 2)).toBe(3);
  });
});

describe("timeToFirstReview", () => {
  it("ignores PRs with no review", () => {
    const rows: PrTimingRow[] = [
      { createdAt: 0, firstReviewAt: null, mergedAt: null },
      { createdAt: 0, firstReviewAt: 3600, mergedAt: 7200 },
    ];
    const t = timeToFirstReview(rows);
    expect(t.count).toBe(1);
    expect(t.medianSeconds).toBe(3600);
  });

  it("returns null stats when sample is empty", () => {
    const t = timeToFirstReview([
      { createdAt: 0, firstReviewAt: null, mergedAt: null },
    ]);
    expect(t.count).toBe(0);
    expect(t.medianSeconds).toBeNull();
    expect(t.p90Seconds).toBeNull();
  });
});

describe("cycleTime", () => {
  it("uses mergedAt - createdAt", () => {
    const rows: PrTimingRow[] = [
      { createdAt: 0, firstReviewAt: 100, mergedAt: 1000 },
      { createdAt: 0, firstReviewAt: 200, mergedAt: 2000 },
      { createdAt: 0, firstReviewAt: null, mergedAt: null }, // closed unmerged → excluded
    ];
    const c = cycleTime(rows);
    expect(c.count).toBe(2);
    expect(c.medianSeconds).toBe(1500);
  });
});

describe("rangeForGranularity", () => {
  const NOW = 1_000_000_000;
  it("day = 1 day window", () => {
    expect(rangeForGranularity("day", NOW)).toEqual({
      from: NOW - 86400,
      to: NOW,
    });
  });
  it("week = 7 day window", () => {
    expect(rangeForGranularity("week", NOW)).toEqual({
      from: NOW - 7 * 86400,
      to: NOW,
    });
  });
  it("month = 30 day window", () => {
    expect(rangeForGranularity("month", NOW)).toEqual({
      from: NOW - 30 * 86400,
      to: NOW,
    });
  });
});

describe("previousRange", () => {
  it("returns the same-length window immediately before from", () => {
    const r = { from: 1000, to: 2000 };
    expect(previousRange(r)).toEqual({ from: -1, to: 999 });
    // length preserved (off-by-one for the inclusive seam)
    expect(previousRange(r).to - previousRange(r).from).toBe(r.to - r.from);
  });
});

describe("deltaPercent", () => {
  it("computes positive growth", () => {
    expect(deltaPercent(150, 100)).toBe(50);
  });
  it("computes negative", () => {
    expect(deltaPercent(50, 100)).toBe(-50);
  });
  it("handles zero previous as null when current > 0", () => {
    expect(deltaPercent(10, 0)).toBeNull();
  });
  it("returns 0 for 0→0", () => {
    expect(deltaPercent(0, 0)).toBe(0);
  });
});
