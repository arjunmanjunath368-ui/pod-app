"use client";

import { useState } from "react";

export type HighlightTile = {
  label: string;
  value: string;
  explain: string;
  icon: string;
  iconDim?: boolean; // shown faded (e.g. an unlit streak at 0)
};

// Three stat tiles that flip on tap to reveal a one-line explanation, so the
// numbers can stay clean while still being self-explaining.
export default function HighlightTiles({ tiles }: { tiles: HighlightTile[] }) {
  const [flipped, setFlipped] = useState<number | null>(null);

  return (
    <div className="mt-6 grid grid-cols-3 gap-2.5">
      {tiles.map((t, i) => {
        const isFlipped = flipped === i;
        return (
          <button
            key={t.label}
            type="button"
            onClick={() => setFlipped(isFlipped ? null : i)}
            aria-label={`${t.label}. ${t.explain} Tap to flip back.`}
            className="relative h-[116px] w-full transition active:scale-95"
            style={{ perspective: "900px" }}
          >
            <div
              className="relative h-full w-full transition-transform duration-500"
              style={{
                transformStyle: "preserve-3d",
                WebkitTransformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Front: icon, number, label */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-ink px-2 py-3 text-paper"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}
              >
                <span
                  className="text-[20px] leading-none"
                  style={{ opacity: t.iconDim ? 0.3 : 1 }}
                >
                  {t.icon}
                </span>
                <div className="mt-1.5 font-serif text-[34px] font-semibold leading-none">
                  {t.value}
                </div>
                <div className="mt-1.5 text-[12px] font-medium leading-tight text-sage-soft">
                  {t.label}
                </div>
                <span className="absolute right-2 top-2 text-[10px] leading-none text-sage-soft/55">
                  ⓘ
                </span>
              </div>

              {/* Back: the explanation */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl bg-ink px-3 text-center"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <p className="text-[11.5px] leading-snug text-paper/90">
                  {t.explain}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
