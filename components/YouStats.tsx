"use client";

import { useState } from "react";
import { activityMeta } from "@/lib/activities";
import type { YouStatsResult, WindowKey } from "@/lib/youStats";

const TABS: { key: WindowKey; label: string; minTenure: number }[] = [
  { key: "week", label: "Week", minTenure: 0 },
  { key: "month", label: "Month", minTenure: 8 },
  { key: "quarter", label: "3 Months", minTenure: 35 },
  { key: "all", label: "All time", minTenure: 95 },
];

export default function YouStats({
  data,
  tenureDays,
}: {
  data: YouStatsResult;
  tenureDays: number;
}) {
  // Only show a timeframe once the user has been on Pod long enough for it to
  // reveal more than the shorter window (no empty "3 Months" for week-old users).
  const tabs = TABS.filter((t) => tenureDays >= t.minTenure);
  const initial: WindowKey =
    tabs.find((t) => t.key === "month")?.key ?? tabs[tabs.length - 1].key;
  const [tab, setTab] = useState<WindowKey>(initial);
  const w = data.windows[tab];

  const tiles: { label: string; value: string }[] = [
    { label: "active days", value: String(w.activeDays) },
    { label: "workouts", value: String(w.sessions) },
    {
      label: "consistency",
      value: w.consistencyPct === null ? "—" : `${w.consistencyPct}%`,
    },
    {
      label: "best streak",
      value: w.bestStreak > 0 ? `${w.bestStreak} wk` : "—",
    },
  ];

  return (
    <div>
      {/* Timeframe selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
              tab === t.key
                ? "bg-ink text-paper"
                : "border border-line bg-card text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {data.currentStreak > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-gold/40 bg-gold/[0.08] px-4 py-2.5">
          <span className="text-[18px]">🔥</span>
          <span className="text-[15px] font-semibold text-ink">
            {data.currentStreak}-week streak going
          </span>
        </div>
      )}

      {/* Stat tiles */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-2xl bg-ink px-4 py-3.5 text-paper"
          >
            <div className="font-serif text-[30px] font-semibold leading-none">
              {t.value}
            </div>
            <div className="mt-1.5 text-[12px] font-medium text-sage-soft">
              {t.label}
            </div>
          </div>
        ))}
      </div>

      {/* Most consistent week */}
      {w.mostConsistentWeek && (
        <div className="mt-2.5 rounded-2xl border border-line bg-card p-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
            🏆 Most consistent week
          </div>
          <div className="mt-1 text-[16px] font-semibold text-ink">
            {w.mostConsistentWeek.label}
          </div>
          <div className="text-[14px] text-muted">
            {w.mostConsistentWeek.count}{" "}
            {w.mostConsistentWeek.count === 1 ? "workout" : "workouts"} that week
          </div>
        </div>
      )}

      {/* Activity breakdown */}
      {w.breakdown.length > 0 ? (
        <div className="mt-2.5 rounded-2xl border border-line bg-card p-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
            What you did
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {w.breakdown.map((b) => {
              const meta = activityMeta(b.key);
              return (
                <div key={b.key}>
                  <div className="mb-1 flex items-center justify-between text-[14px]">
                    <span className="font-medium text-ink-soft">
                      {meta.emoji} {meta.label}
                    </span>
                    <span className="text-muted">
                      {b.count} · {b.pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-paper-2">
                    <div
                      className="h-full rounded-full bg-terra"
                      style={{ width: `${Math.max(b.pct, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-2.5 rounded-2xl border border-dashed border-line bg-card p-6 text-center">
          <p className="text-[15px] text-muted">
            No workouts logged in this window yet.
          </p>
        </div>
      )}
    </div>
  );
}
