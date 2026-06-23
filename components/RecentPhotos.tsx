"use client";

import { useState } from "react";
import { activityMeta } from "@/lib/activities";
import { thumb } from "@/lib/img";
import Avatar from "@/components/Avatar";
import type { FeedItem } from "@/components/Feed";

// A light, swipeable stack of the most recent photo logs — the focal "what just
// happened" surface, so the latest proof is front-and-center without scrolling
// a heavy feed. Images lazy-load; tapping opens a full-res lightbox.
export default function RecentPhotos({ items }: { items: FeedItem[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
        <span>📸 Recent</span>
      </div>

      <div
        className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((it) => {
          const metas = (it.activities?.length
            ? it.activities
            : [it.activity]
          ).map((k) => activityMeta(k as any));
          const label = metas
            .map((m) => `${m.emoji} ${m.label.toLowerCase()}`)
            .join(" + ");
          return (
            <button
              key={it.id}
              onClick={() => it.photoUrl && setLightbox(it.photoUrl)}
              className="relative aspect-[3/4] w-[72%] max-w-[260px] shrink-0 snap-start overflow-hidden rounded-2xl bg-card text-left active:scale-[0.99]"
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
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
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
            </button>
          );
        })}
      </div>

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
