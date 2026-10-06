"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { unitEmoji, unitPhrase } from "@/lib/meals";

export type OpenTabView = {
  periodStart: string; // identifies the tab together with the debtor
  periodLabel: string;
  userId: string; // who owes
  name: string;
  owes: number;
  unit: string;
};

// What's still owed after a period settled. Pod keeps the tab; the pod settles
// by actually treating each other, and then a pod-mate marks it done. You can't
// clear your own tab — someone else confirms you've paid up — and it's a
// permanent record, so there's a confirm step.
export default function MealTabs({
  podId,
  userId,
  tabs,
}: {
  podId: string;
  userId: string;
  tabs: OpenTabView[];
}) {
  const router = useRouter();
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [err, setErr] = useState("");

  if (tabs.length === 0) return null;

  const keyOf = (t: OpenTabView) => `${t.periodStart}|${t.userId}`;

  async function settle(t: OpenTabView) {
    const key = keyOf(t);
    setBusyKey(key);
    setErr("");
    const { error } = await createClient().from("meal_tab_status").insert({
      pod_id: podId,
      period_start: t.periodStart,
      user_id: t.userId,
      settled_by: userId,
    });
    setBusyKey(null);
    setConfirmKey(null);
    if (error) {
      setErr(
        error.code === "23505"
          ? "Someone already marked that one settled."
          : "Couldn't save that — try again in a moment."
      );
    }
    router.refresh();
  }

  return (
    <div className="mb-4 rounded-2xl border border-gold/40 bg-gold/[0.07] p-4">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
        Open tabs
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Treat the pod, then a pod-mate marks it settled.
      </p>

      <div className="mt-3 space-y-3">
        {tabs.map((t) => {
          const key = keyOf(t);
          const mine = t.userId === userId;
          return (
            <div key={key} className="text-[15px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-ink">
                    {unitEmoji(t.unit)}{" "}
                    <span className="font-semibold">
                      {mine ? "You owe" : `${t.name} owes`}
                    </span>{" "}
                    the pod {unitPhrase(t.unit, t.owes)}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {t.periodLabel}
                  </div>
                </div>
                {!mine &&
                  (confirmKey === key ? (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => setConfirmKey(null)}
                        disabled={busyKey === key}
                        className="rounded-full border border-line bg-card px-3 py-1.5 text-[12px] font-semibold text-muted active:scale-95"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => settle(t)}
                        disabled={busyKey === key}
                        className="rounded-full bg-terra px-3 py-1.5 text-[12px] font-semibold text-paper disabled:opacity-60 active:scale-95"
                      >
                        {busyKey === key ? "…" : "Confirm"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmKey(key)}
                      className="shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-[12px] font-semibold text-ink-soft active:scale-95"
                    >
                      Mark settled
                    </button>
                  ))}
              </div>
              {mine && (
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Once you&apos;ve treated them, a pod-mate marks this settled.
                </p>
              )}
            </div>
          );
        })}
      </div>
      {err && <p className="mt-3 text-[13px] text-terra">{err}</p>}
    </div>
  );
}
