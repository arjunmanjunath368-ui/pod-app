"use client";

import { useState } from "react";

// Pieces only the demo pod uses.

// A lock-screen style notification that drops in once when the demo opens,
// showing what "your turn" looks like on a phone.
export function NotificationPreview({ title, body }: { title: string; body: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="podnotif mt-4" role="status">
      <style>{`
        @keyframes podDrop { 0% { opacity: 0; transform: translateY(-18px) scale(.97) } 100% { opacity: 1; transform: none } }
        .podnotif { animation: podDrop .55s cubic-bezier(.2,.8,.2,1) .7s both }
        @media (prefers-reduced-motion: reduce) { .podnotif { animation: none } }
      `}</style>
      <button
        onClick={() => setHidden(true)}
        className="flex w-full items-start gap-3 rounded-[22px] border border-line bg-card/95 p-3.5 text-left shadow-pod-lg backdrop-blur"
        aria-label="Dismiss notification preview"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ink text-[18px]">
          🫛
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[14px] font-semibold text-ink">{title}</span>
            <span className="shrink-0 text-[12px] text-muted">now</span>
          </span>
          <span className="mt-0.5 block text-[14px] leading-snug text-ink-soft">{body}</span>
        </span>
      </button>
    </div>
  );
}

// Nudge and challenge buttons that only change on screen.
export function DemoActions({ name }: { name: string }) {
  const [nudged, setNudged] = useState(false);
  const [challenged, setChallenged] = useState(false);
  return (
    <>
      <button
        onClick={() => setChallenged(true)}
        disabled={challenged}
        className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
          challenged ? "bg-paper-2 text-muted" : "bg-ink/[0.06] text-ink-soft"
        }`}
      >
        {challenged ? "Challenged 💪" : "💪 Challenge"}
      </button>
      <button
        onClick={() => setNudged(true)}
        disabled={nudged}
        aria-label={`Nudge ${name}`}
        className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
          nudged ? "bg-paper-2 text-muted" : "bg-terra/[0.10] text-terra"
        }`}
      >
        {nudged ? "Nudged 👋" : "👋 Nudge"}
      </button>
    </>
  );
}

// A one-tap demo action that only changes on screen ("Suggested to the pod").
export function DemoActionButton({
  label,
  doneLabel,
  tone = "light",
  full = true,
}: {
  label: string;
  doneLabel: string;
  tone?: "light" | "terra" | "ink";
  full?: boolean;
}) {
  const [done, setDone] = useState(false);
  const base = `${full ? "w-full" : ""} rounded-full px-4 py-2.5 text-[14px] font-semibold transition active:scale-[0.98]`;
  const cls = done
    ? tone === "light"
      ? "bg-paper/20 text-paper"
      : "bg-paper-2 text-muted"
    : tone === "light"
      ? "bg-paper text-ink"
      : tone === "terra"
        ? "bg-terra text-paper"
        : "bg-ink text-paper";
  return (
    <button onClick={() => setDone(true)} disabled={done} className={`${base} ${cls}`}>
      {done ? doneLabel : label}
    </button>
  );
}
