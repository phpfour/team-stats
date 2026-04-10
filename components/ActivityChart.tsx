"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { day: number; count: number };

export function ActivityChart({ data }: { data: Point[] }) {
  const formatted = data.map((d) => ({
    label: new Date(d.day * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    count: d.count,
  }));

  if (formatted.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center font-mono text-xs uppercase tracking-wider text-ink-faint">
        No activity in this range
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="0"
            stroke="#ede7d6"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#8a8478", fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "#e6dfcf" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#8a8478", fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            cursor={{ fill: "#f5e6df" }}
            contentStyle={{
              background: "#1a1814",
              border: "none",
              borderRadius: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "#faf8f3",
              padding: "6px 10px",
            }}
            itemStyle={{ color: "#faf8f3" }}
            labelStyle={{ color: "#b8b2a2", marginBottom: 2 }}
          />
          <Bar dataKey="count" fill="#1a1814" maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
