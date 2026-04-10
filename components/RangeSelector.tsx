"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS: Array<{ key: string; label: string }> = [
  { key: "day", label: "24h" },
  { key: "week", label: "7d" },
  { key: "month", label: "30d" },
];

export function RangeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("range") ?? "month";

  const select = (key: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("range", key);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="inline-flex items-center gap-1 border border-rule bg-paper px-1 py-1 font-mono text-[11px] uppercase tracking-wider">
      {OPTIONS.map((o) => {
        const active = current === o.key;
        return (
          <button
            key={o.key}
            onClick={() => select(o.key)}
            className={
              "px-3 py-1.5 transition-colors " +
              (active
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-paper-soft")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
