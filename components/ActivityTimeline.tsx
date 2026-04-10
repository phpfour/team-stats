"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityEvent, ActivityKind } from "@/lib/db/queries";

type Props = {
  login: string;
  initialEvents: ActivityEvent[];
  initialCursor: number | null;
};

const KIND_LABEL: Record<ActivityKind, string> = {
  pr_opened: "Opened PR",
  pr_merged: "Merged PR",
  pr_closed: "Closed PR",
  review_approved: "Approved",
  review_changes_requested: "Requested changes",
  review_commented: "Reviewed",
  commit: "Commit",
  issue_opened: "Opened issue",
  issue_closed: "Closed issue",
};

// Only "outcome" events get tinted. Everything else is ink-mute so the
// page has a single neutral baseline and color carries meaning.
const KIND_TONE: Record<ActivityKind, string> = {
  pr_opened: "text-ink-mute",
  pr_merged: "text-positive",
  pr_closed: "text-ink-mute",
  review_approved: "text-positive",
  review_changes_requested: "text-negative",
  review_commented: "text-ink-mute",
  commit: "text-ink-mute",
  issue_opened: "text-ink-mute",
  issue_closed: "text-ink-mute",
};

function formatRelative(epochSeconds: number, now: number): string {
  const diff = now - epochSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 365)
    return new Date(epochSeconds * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  return new Date(epochSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatExact(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateBucket(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Today";
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate()
  )
    return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function ActivityTimeline({ login, initialEvents, initialCursor }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Math.floor(Date.now() / 1000));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 60_000);
    return () => clearInterval(id);
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || cursor === null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/members/${encodeURIComponent(login)}/activity?before=${cursor}&limit=30`,
      );
      if (!res.ok) throw new Error(`http ${res.status}`);
      const data = (await res.json()) as {
        events: ActivityEvent[];
        nextCursor: number | null;
      };
      setEvents((prev) => [...prev, ...data.events]);
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, login]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || cursor === null) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, cursor]);

  if (events.length === 0) {
    return (
      <div className="border border-rule bg-paper-soft/30 py-20 text-center font-mono text-[11px] uppercase tracking-wider text-ink-faint">
        No activity recorded
      </div>
    );
  }

  // Group events by day for the section dividers.
  type Group = { bucket: string; items: ActivityEvent[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  for (const ev of events) {
    const bucket = dateBucket(ev.at);
    if (!current || current.bucket !== bucket) {
      current = { bucket, items: [] };
      groups.push(current);
    }
    current.items.push(ev);
  }

  return (
    <div>
      {groups.map((g, gi) => (
        <section key={g.bucket} className={gi === 0 ? "" : "mt-12"}>
          {/* Day header — the only display moment in the timeline */}
          <div className={gi === 0 ? "" : "border-t border-rule pt-6"}>
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h3 className="font-display text-2xl italic text-ink leading-none">
                {g.bucket}
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint tabular">
                {g.items.length} {g.items.length === 1 ? "event" : "events"}
              </span>
            </div>
          </div>
          <ul className="divide-y divide-rule-soft border-y border-rule-soft">
            {g.items.map((ev) => (
              <TimelineItem key={ev.id} ev={ev} now={now} />
            ))}
          </ul>
        </section>
      ))}

      <div
        ref={sentinelRef}
        className="mt-6 text-center font-mono text-[10px] uppercase tracking-wider text-ink-faint"
      >
        {loading
          ? "Loading more…"
          : error
            ? `Error: ${error}`
            : cursor === null
              ? "End of timeline"
              : "·"}
      </div>
    </div>
  );
}

function TimelineItem({ ev, now }: { ev: ActivityEvent; now: number }) {
  const tone = KIND_TONE[ev.kind];
  const isColored = tone !== "text-ink-mute";
  const showDiff =
    typeof ev.additions === "number" &&
    typeof ev.deletions === "number" &&
    (ev.additions > 0 || ev.deletions > 0);

  return (
    <li className="group">
      <a
        href={ev.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block py-4 px-1 transition-colors hover:bg-paper-soft/50"
      >
        {/* meta row — single quiet line */}
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2 min-w-0 font-mono text-[10px] uppercase tracking-wider text-ink-mute">
            <span className={isColored ? tone : undefined}>
              {KIND_LABEL[ev.kind]}
            </span>
            <span className="text-ink-faint">·</span>
            <span className="truncate">
              {ev.repo} {ev.ref}
            </span>
          </div>
          <time
            dateTime={new Date(ev.at * 1000).toISOString()}
            title={formatExact(ev.at)}
            className="font-mono text-[10px] uppercase tracking-wider text-ink-faint tabular whitespace-nowrap"
          >
            {formatRelative(ev.at, now)}
          </time>
        </div>

        {/* title — the only loud thing in each row */}
        <div className="mt-1.5 font-sans text-[15px] text-ink leading-snug group-hover:text-accent transition-colors">
          {ev.title}
        </div>

        {/* body excerpt */}
        {ev.body ? (
          <p className="mt-1.5 font-sans text-[13px] text-ink-soft leading-relaxed line-clamp-2">
            {ev.body}
          </p>
        ) : null}

        {/* diff stats */}
        {showDiff ? (
          <div className="mt-2 font-mono text-[10px] tabular text-ink-mute">
            <span>+{ev.additions}</span>
            <span className="mx-2">·</span>
            <span>−{ev.deletions}</span>
          </div>
        ) : null}
      </a>
    </li>
  );
}
