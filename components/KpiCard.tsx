import { formatDelta } from "@/lib/format";

type Props = {
  label: string;
  value: string | number;
  deltaPct?: number | null;
  hint?: string;
};

export function KpiCard({ label, value, deltaPct, hint }: Props) {
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
    <div className="group relative bg-paper-soft/40 border-t border-rule px-5 pt-5 pb-6 transition-colors hover:bg-paper-soft/70">
      {/* eyebrow */}
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
        {label}
      </div>

      {/* primary number */}
      <div className="mt-3 font-sans text-4xl font-medium leading-none text-ink tabular tracking-tight">
        {value}
      </div>

      {/* delta + hint row */}
      <div className="mt-4 flex items-baseline gap-3 text-[11px]">
        {delta ? (
          <span className={`tabular font-mono ${toneClass}`}>
            {arrow ? <span className="mr-0.5">{arrow}</span> : null}
            {delta.text.replace(/^[+-]/, "")}
          </span>
        ) : null}
        {hint ? (
          <span className="font-mono text-ink-faint tabular">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}
