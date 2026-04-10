// Display formatters used across the dashboard.

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(0)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

export function formatDelta(pct: number | null): {
  text: string;
  tone: "up" | "down" | "flat" | "unknown";
} {
  if (pct === null) return { text: "—", tone: "unknown" };
  if (pct === 0) return { text: "0%", tone: "flat" };
  const sign = pct > 0 ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(0)}%`,
    tone: pct > 0 ? "up" : "down",
  };
}

export function formatDateShort(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
