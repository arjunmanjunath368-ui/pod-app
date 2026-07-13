"use client";

import { useRef, useState } from "react";
import { activityMeta } from "@/lib/activities";
import { thumb } from "@/lib/img";
import Avatar from "@/components/Avatar";
import type { FeedItem } from "@/components/Feed";

// The latest photo logs, held like a hand of cards. Swipe to move through the
// deck (drag follows your finger); tap the front card to open it full-res.
// Cards you've passed fly off to the left, so the direction of travel is always
// legible — no guessing which tap does what.
export default function RecentPhotos({ items }: { items: FeedItem[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [front, setFront] = useState(0);
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);

  if (items.length === 0) return null;

  const deck = items.slice(0, 6);
  const n = deck.length;
  const SWIPE = 45; // px before it counts as a swipe

  function go(next: number) {
    setFront(Math.min(Math.max(next, 0), n - 1));
  }

  function onStart(x: number) {
    startX.current = x;
    moved.current = false;
  }
  function onMove(x: number) {
    if (startX.current === null) return;
    const dx = x - startX.current;
    if (Math.abs(dx) > 6) moved.current = true;
    // Resist dragging past the ends.
    const atEdge =
      (dx > 0 && front === 0) || (dx < 0 && front === n - 1);
    setDrag(atEdge ? dx * 0.25 : dx);
  }
  function onEnd() {
    if (startX.current === null) return;
    if (drag <= -SWIPE) go(front + 1);
    else if (drag >= SWIPE) go(front - 1);
    startX.current = null;
    setDrag(0);
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
        <span>📸 Recent</span>
        {n > 1 && (
          <span className="text-[12px] font-medium normal-case tracking-normal">
            {front + 1} / {n}
          </span>
        )}
      </div>

      <div
        className="relative mx-auto h-[292px] w-full max-w-[300px] touch-pan-y select-none"
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") onStart(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" && startX.current !== null)
            onMove(e.clientX);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") onEnd();
        }}
        onPointerLeave={() => {
          if (startX.current !== null) onEnd();
        }}
      >
        {deck.map((it, i) => {
          const metas = (it.activities?.length
            ? it.activities
            : [it.activity]
          ).map((k) => activityMeta(k as any));
          const label = metas
            .map((m) => `${m.emoji} ${m.label.toLowerCase()}`)
            .join(" + ");

          const offset = i - front;
          const isFront = offset === 0;
          const passed = offset < 0; // already swiped through
          const depth = Math.min(offset, 4);

          let transform: string;
          let opacity = 1;
          if (passed) {
            // Flown off to the left — keeps the direction of travel obvious.
            transform = `translateX(-135%) rotate(-14deg) scale(.95)`;
            opacity = 0;
          } else if (isFront) {
            transform = `translateX(calc(-50% + ${drag}px)) rotate(${
              drag * 0.03
            }deg)`;
          } else {
            // Fanned behind the front card.
            transform = `translateX(-50%) rotate(${depth * 4}deg) translateY(${
              depth * 7
            }px) scale(${1 - depth * 0.045})`;
          }

          return (
            <button
              key={it.id}
              onClick={() => {
                if (moved.current) return; // that was a swipe, not a tap
                if (isFront) {
                  if (it.photoUrl) setLightbox(it.photoUrl);
                } else if (!passed) {
                  go(i);
                }
              }}
              aria-label={isFront ? "Open photo" : "Bring photo forward"}
              className={`absolute left-1/2 top-0 h-[272px] w-[202px] overflow-hidden rounded-2xl bg-card text-left shadow-pod-lg ring-1 ring-black/[0.06] ${
                drag !== 0 && isFront
                  ? ""
                  : "transition-all duration-300 ease-out"
              }`}
              style={{
                transform: passed
                  ? transform
                  : isFront
                    ? transform
                    : transform,
                transformOrigin: "50% 120%",
                zIndex: isFront ? 50 : 20 - depth,
                opacity,
                pointerEvents: passed ? "none" : "auto",
                filter: isFront ? "none" : "brightness(0.93)",
              }}
            >
              {it.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb(it.photoUrl, 600)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="pointer-events-none h-full w-full object-cover"
                />
              )}
              {isFront && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-8">
                  <div className="flex items-center gap-2">
                    <Avatar
                      url={it.avatarUrl}
                      initials={it.initials}
                      color={it.color}
                      size={24}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-white">
                        {it.isMine ? "You" : it.authorName}
                      </div>
                      <div className="truncate text-[11px] text-white/75">
                        {label} · {it.timeLabel}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {n > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-3">
          <button
            onClick={() => go(front - 1)}
            disabled={front === 0}
            aria-label="Previous photo"
            className="text-[18px] leading-none text-muted disabled:opacity-25 active:scale-90"
          >
            ‹
          </button>
          <div className="flex gap-1.5">
            {deck.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={`Photo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === front ? "w-5 bg-terra" : "w-1.5 bg-line"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => go(front + 1)}
            disabled={front === n - 1}
            aria-label="Next photo"
            className="text-[18px] leading-none text-muted disabled:opacity-25 active:scale-90"
          >
            ›
          </button>
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
}
