"use client";

import { useEffect, useState } from "react";

// "?" on Home. Short answers to what the screen shows, in the order people
// ask them.
const ITEMS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "✅",
    title: "Active days",
    body: "Your goal is a number of active days a week. Any activity makes a day active, and a day counts once however much you do. Your days count from the moment you join.",
  },
  {
    emoji: "⌚",
    title: "The rings",
    body: "Weekly goal is how much of this week's goal you've hit. With WHOOP, Recovery shows today's score and Sleep shows last night's. Only you see those. Your pod never does.",
  },
  {
    emoji: "🫛",
    title: "Pod Perfect week",
    body: "When everyone in the pod hits their own goal, that's a Pod Perfect week. They build the pod streak, which runs Monday to Sunday. Someone who joins mid-week joins the pod total the next Monday.",
  },
  {
    emoji: "💤",
    title: "Rest days",
    body: "With WHOOP and Recovery & sleep on, a red-recovery day counts as a rest day automatically, up to 2 a week. Your pod sees you resting, not missing.",
  },
  {
    emoji: "🔔",
    title: "Nudges",
    body: "When someone in your pod logs, the others hear it's their turn. If you set your usual move times, Pod also gives you one nudge when your window opens and you haven't moved yet.",
  },
  {
    emoji: "⏸",
    title: "Pausing",
    body: "Away or sick? Pause the week from the pod's settings and it won't count against you. After 7 quiet days Pod pauses you automatically, and logging anything brings you straight back.",
  },
];

export default function HowItWorks() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="How Pod works"
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[13px] font-semibold text-ink-soft transition active:scale-95"
      >
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ink text-[11px] font-bold text-paper">
          ?
        </span>
        How it works
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="How Pod works">
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="relative max-h-[86vh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] bg-paper px-6 pb-10 pt-3 shadow-pod-lg">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-[24px] font-semibold text-ink">How Pod works</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full bg-paper-2 px-3 py-1.5 text-[13px] font-semibold text-ink-soft active:scale-95"
              >
                Done
              </button>
            </div>
            <ul className="mt-4 flex flex-col gap-4">
              {ITEMS.map((it) => (
                <li key={it.title} className="flex gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-[17px] shadow-pod">
                    {it.emoji}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-ink">{it.title}</div>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-ink-soft">{it.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <a
              href="/app?tour=1"
              className="mt-6 block rounded-2xl border border-line bg-card p-3.5 text-center text-[14px] font-semibold text-ink-soft active:scale-[0.99]"
            >
              ↺ Replay the welcome
            </a>
          </div>
        </div>
      )}
    </>
  );
}
