import { formatDelta } from "@/lib/format";

type Props = {
  label: string;
  value: string | number;
  deltaPct?: number | null;
  hint?: string;
};

/**
 * Compact horizontal stat row used in the member sidebar. Designed to stack
 * densely without losing the typographic hierarchy.
 */
export function StatRow({ label, value, deltaPct, hint }: Props) {
  const delta = deltaPct !== undefined ? formatDelta(deltaPct) : null;
  const toneClass =
    delta?.tone === "up"
      ? "text-positive"
      : delta?.tone === "down"
        ? "text-negative"
        : "text-ink-mute";
  const arrow =
    delta?.tone === "up" ? "↑" : delta?.tone === "down" ? "↓" : null;

  return (
    <div className="flex items-baseline justify-between gap-4 py-3 border-b border-rule-soft last:border-0">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
          {label}
        </div>
        {hint ? (
          <div className="font-mono text-[10px] text-ink-faint tabular mt-0.5 truncate">
            {hint}
          </div>
        ) : null}
      </div>
      <div className="flex items-baseline gap-2 whitespace-nowrap">
        {delta ? (
          <span className={`font-mono text-[10px] tabular ${toneClass}`}>
            {arrow}
            {delta.text.replace(/^[+-]/, "")}
          </span>
        ) : null}
        <span className="font-sans text-xl font-medium text-ink leading-none tabular tracking-tight">
          {value}
        </span>
      </div>
    </div>
  );
}
