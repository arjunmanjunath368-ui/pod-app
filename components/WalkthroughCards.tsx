"use client";

import { useState, useRef } from "react";

export type WalkCard = { emoji?: string; title: string; body: string };

// Swipeable card carousel. With onDone it acts as an onboarding flow (Next →
// Get started, plus Skip); without onDone it's a purely informational carousel
// (swipe / Next / dots, no terminal action). No dependencies — touch + CSS.
export default function WalkthroughCards({
  cards,
  onDone,
  doneLabel = "Get started",
}: {
  cards: WalkCard[];
  onDone?: () => void;
  doneLabel?: string;
}) {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const last = i === cards.length - 1;

  const go = (n: number) => setI(Math.max(0, Math.min(cards.length - 1, n)));

  return (
    <div>
      <div
        className="overflow-hidden"
        onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (startX.current == null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          if (dx < -40) go(i + 1);
          else if (dx > 40) go(i - 1);
          startX.current = null;
        }}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {cards.map((c, idx) => (
            <div key={idx} className="w-full shrink-0 px-0.5">
              <div className="rounded-3xl border border-line bg-card p-7 shadow-pod">
                {c.emoji && <div className="text-[34px]">{c.emoji}</div>}
                <h2 className="mt-3 font-serif text-[22px] font-semibold leading-tight text-ink">
                  {c.title}
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">
                  {c.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        {cards.map((_, idx) => (
          <button
            key={idx}
            onClick={() => go(idx)}
            aria-label={`Go to card ${idx + 1}`}
            className={`h-2 rounded-full transition-all ${
              idx === i ? "w-6 bg-terra" : "w-2 bg-line"
            }`}
          />
        ))}
      </div>

      {!last ? (
        <button
          onClick={() => go(i + 1)}
          className="mt-6 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98]"
        >
          Next
        </button>
      ) : onDone ? (
        <button
          onClick={onDone}
          className="mt-6 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98]"
        >
          {doneLabel}
        </button>
      ) : (
        // Info carousel: keep the same footprint on the last card so nothing
        // below (e.g. Sign out) shifts up into the tap path.
        <div className="mt-6 h-[56px]" aria-hidden="true" />
      )}

      {onDone && !last && (
        <button
          onClick={onDone}
          className="mt-3 w-full text-center text-[14px] font-semibold text-muted"
        >
          Skip
        </button>
      )}
    </div>
  );
}
