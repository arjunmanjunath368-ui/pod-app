"use client";

import { useState } from "react";

export type PrCelebration = {
  id: string;
  name: string; // achiever's display name
  pbName: string; // the personal-best name
  podName: string;
};

const DISMISS_KEY = "pod_pr_dismissed";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export default function PrCelebrations({
  events,
}: {
  events: PrCelebration[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  const visible = events.filter((e) => !dismissed.has(e.id));
  if (visible.length === 0) return null;

  return (
    <div className="mt-4 space-y-2.5">
      {visible.map((e) => (
        <div
          key={e.id}
          className="flex items-start gap-3 rounded-2xl border border-sage/40 bg-sage/[0.10] p-4"
        >
          <div className="text-[20px] leading-none">🏆</div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold leading-snug text-ink">
              {e.name.split(/\s+/)[0]} just beat their personal best!
            </div>
            <div className="mt-0.5 text-[13px] text-ink-soft">
              {e.pbName} · {e.podName} — give 'em a shout 👏
            </div>
          </div>
          <button
            onClick={() => dismiss(e.id)}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] text-muted active:scale-90"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
