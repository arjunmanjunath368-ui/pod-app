"use client";

import { useState } from "react";

export type HighlightTile = {
  label: string;
  value: string;
  explain: string;
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
            className="relative h-[104px] w-full transition active:scale-95"
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
              {/* Front: the number */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-ink p-3 text-paper"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}
              >
                <div className="font-serif text-[26px] font-semibold leading-none">
                  {t.value}
                </div>
                <div className="mt-1 text-[12px] leading-tight text-sage-soft">
                  {t.label}
                </div>
                <span className="absolute right-2 top-2 text-[10px] leading-none text-sage-soft/60">
                  ⓘ
                </span>
              </div>

              {/* Back: the explanation */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl bg-ink px-2.5 text-center"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <p className="text-[11px] leading-snug text-paper/90">
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
