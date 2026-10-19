"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shown on Home to members who turned on rest days, until today counts.
// Tapping asks the server to check today's WHOOP recovery; only a red day
// logs a rest day. The score never reaches this component.
const MESSAGES: Record<string, string> = {
  not_red:
    "Your recovery isn't in the red today, so a rest day won't count. A short walk or 10 minutes of mobility will.",
  calibrating:
    "WHOOP is still learning your baseline, so rest days start once your recovery is calibrated.",
  unscored:
    "WHOOP hasn't scored today's recovery yet. Try again once it has synced.",
  cap: "You've used both rest days this week. Log anything today and it counts.",
  already_active: "Today already counts. Rest up.",
  reconnect: "WHOOP needs reconnecting before rest days work. Go to Settings.",
  off: "Rest days are off. Turn them on in Settings.",
  error: "Couldn't check right now. Try again in a moment.",
};

export default function RestDayCard({ restedToday }: { restedToday: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState(restedToday);

  async function rest() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/rest-day", { method: "POST" });
      const j = await res.json().catch(() => ({ status: "error" }));
      if (j.status === "logged") {
        setDone(true);
        router.refresh();
      } else {
        setNote(MESSAGES[j.status] ?? MESSAGES.error);
      }
    } catch {
      setNote(MESSAGES.error);
    }
    setBusy(false);
  }

  async function undo() {
    setBusy(true);
    try {
      await fetch("/api/rest-day", { method: "DELETE" });
      setDone(false);
      router.refresh();
    } catch {
      setNote(MESSAGES.error);
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-sage/30 bg-sage/[0.08] p-4">
        <span className="text-[22px] leading-none">💤</span>
        <p className="flex-1 text-[14px] font-medium leading-snug text-ink">
          Rest day logged. Recovering counts as showing up today.
        </p>
        <button
          onClick={undo}
          disabled={busy}
          className="shrink-0 text-[13px] font-semibold text-muted disabled:opacity-50"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="text-[22px] leading-none">💤</span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-ink">
            Red recovery today?
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">
            Rest counts as an active day when WHOOP has you in the red.
          </p>
        </div>
        <button
          onClick={rest}
          disabled={busy}
          className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-[13px] font-semibold text-paper transition disabled:opacity-50 active:scale-95"
        >
          {busy ? "Checking…" : "Take a rest day"}
        </button>
      </div>
      {note && (
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">{note}</p>
      )}
    </div>
  );
}
