// Time-range helpers. All values are Unix epoch seconds.
//
// Convention: ranges are inclusive on both ends. The "previous" period is the
// equivalent-length window immediately before `from`.

export type Range = { from: number; to: number };
export type Granularity = "day" | "week" | "month" | "custom";

const SECOND = 1;
const DAY = 86400;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function rangeForGranularity(
  granularity: Granularity,
  now: number = nowSeconds(),
): Range {
  switch (granularity) {
    case "day":
      return { from: now - DAY, to: now };
    case "week":
      return { from: now - 7 * DAY, to: now };
    case "month":
      return { from: now - 30 * DAY, to: now };
    case "custom":
      // Caller must supply explicit dates; default to last 30 days.
      return { from: now - 30 * DAY, to: now };
  }
}

export function previousRange(range: Range): Range {
  const length = range.to - range.from;
  return { from: range.from - length - SECOND, to: range.from - SECOND };
}

export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // undefined % change from zero
  return ((current - previous) / previous) * 100;
}
