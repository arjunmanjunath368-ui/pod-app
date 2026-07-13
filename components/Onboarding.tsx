"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Step = {
  emoji: string;
  title: string;
  body: string;
};

// What a new member needs to understand before Pod makes sense. Ordered the way
// they'll actually meet it: what this is → your goal → logging → the one rule
// that makes it safe → money (optional) → permission to step away.
const STEPS: Step[] = [
  {
    emoji: "\u{1FADB}",
    title: "What a pod is",
    body: "A handful of people you trust, each chasing their own goal and keeping each other honest, week to week. No randoms, no global leaderboard.",
  },
  {
    emoji: "\u{1F3AF}",
    title: "Different goals, same game",
    body: "Your goal is yours alone \u2014 nobody's ranked on who lifts more or runs farther. You're measured on one thing: showing up.",
  },
  {
    emoji: "\u{1F4F8}",
    title: "Log it, and your pod sees it",
    body: "Tap + to log what you did, with a photo if you want. That's the whole ritual \u2014 your pod sees you showed up, and cheers, nudges or challenges you.",
  },
  {
    emoji: "\u{1F4B0}",
    title: "Stakes, if you want teeth",
    body: "Put real money on the week. Staked logs need a live photo taken in the app, and your pod can flag anything that looks off. Miss your goal, you pay in.",
  },
  {
    emoji: "\u23F8",
    title: "Life happens \u2014 pause it",
    body: "Travelling, sick, buried at work? Pause your week. It won't count against you, and your pod knows you're out rather than wondering where you went.",
  },
];

export default function Onboarding({
  userId,
  open,
}: {
  userId: string;
  open: boolean;
}) {
  const [show, setShow] = useState(open);
  const [i, setI] = useState(0);

  if (!show) return null;

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  async function finish() {
    setShow(false);
    try {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("id", userId);
    } catch {
      /* non-blocking: worst case they see it once more */
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-paper">
      <div className="flex justify-end px-5 pt-5">
        <button
          onClick={finish}
          className="text-[14px] font-semibold text-muted active:scale-95"
        >
          Skip
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="text-[56px] leading-none">{step.emoji}</div>
        <h2 className="mt-6 font-serif text-[27px] font-semibold leading-tight text-ink">
          {step.title}
        </h2>
        <p className="mt-3 max-w-sm text-[16px] leading-relaxed text-ink-soft">
          {step.body}
        </p>
      </div>

      <div className="px-8 pb-10">
        <div className="mb-5 flex justify-center gap-1.5">
          {STEPS.map((_, n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                n === i ? "w-5 bg-terra" : "w-1.5 bg-line"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => (last ? finish() : setI(i + 1))}
          className="w-full rounded-full bg-terra py-3.5 text-[16px] font-semibold text-paper active:scale-[0.98]"
        >
          {last ? "Let's go" : "Next"}
        </button>
        {i > 0 && (
          <button
            onClick={() => setI(i - 1)}
            className="mt-2 w-full py-2 text-[14px] font-semibold text-muted active:scale-95"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}
