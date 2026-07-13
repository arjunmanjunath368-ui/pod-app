"use client";

import { useState } from "react";
import { activityMeta } from "@/lib/activities";
import { thumb } from "@/lib/img";
import Avatar from "@/components/Avatar";
import type { FeedItem } from "@/components/Feed";

// The most recent photo logs, held like a hand of cards: the newest sits square
// in front, the rest fan out behind it. Tap a card behind to bring it forward;
// tap the front card to open it full-res. Images lazy-load.
export default function RecentPhotos({ items }: { items: FeedItem[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [front, setFront] = useState(0);
  if (items.length === 0) return null;

  const deck = items.slice(0, 6);
  const n = deck.length;

  // Fan geometry: cards pivot from a point below the deck, so they splay like
  // cards in a hand rather than sliding sideways.
  const SPREAD = n > 1 ? Math.min(9, 26 / (n - 1)) : 0; // degrees between cards
  const mid = (n - 1) / 2;

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
        <span>📸 Recent</span>
        {n > 1 && (
          <span className="normal-case tracking-normal text-[12px] font-medium">
            {front + 1} / {n}
          </span>
        )}
      </div>

      <div className="relative mx-auto h-[290px] w-full max-w-[300px]">
        {deck.map((it, i) => {
          const metas = (it.activities?.length
            ? it.activities
            : [it.activity]
          ).map((k) => activityMeta(k as any));
          const label = metas
            .map((m) => `${m.emoji} ${m.label.toLowerCase()}`)
            .join(" + ");

          const isFront = i === front;
          // Distance from the front card decides how far back it sits.
          const offset = i - front;
          const angle = isFront ? 0 : (i - mid) * SPREAD;
          const depth = Math.min(Math.abs(offset), 4);

          return (
            <button
              key={it.id}
              onClick={() => {
                if (isFront) {
                  if (it.photoUrl) setLightbox(it.photoUrl);
                } else {
                  setFront(i);
                }
              }}
              aria-label={
                isFront ? "Open photo" : `Bring ${it.authorName}'s photo forward`
              }
              className="absolute left-1/2 top-0 h-[270px] w-[200px] overflow-hidden rounded-2xl bg-card text-left shadow-pod-lg ring-1 ring-black/[0.06] transition-transform duration-300 ease-out"
              style={{
                transform: `translateX(-50%) rotate(${angle}deg) translateY(${
                  isFront ? 0 : 10 + depth * 3
                }px) scale(${isFront ? 1 : 1 - depth * 0.03})`,
                transformOrigin: "50% 130%",
                zIndex: isFront ? 50 : 20 - depth,
                filter: isFront ? "none" : "brightness(0.94)",
              }}
            >
              {it.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb(it.photoUrl, 600)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
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
        <div className="mt-2 flex justify-center gap-1.5">
          {deck.map((_, i) => (
            <button
              key={i}
              onClick={() => setFront(i)}
              aria-label={`Photo ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === front ? "w-5 bg-terra" : "w-1.5 bg-line"
              }`}
            />
          ))}
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
