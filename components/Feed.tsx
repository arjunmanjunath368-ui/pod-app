"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { activityMeta } from "@/lib/activities";

type Kind = "clap" | "fire" | "heart";
const KINDS: { kind: Kind; emoji: string }[] = [
  { kind: "clap", emoji: "👏" },
  { kind: "fire", emoji: "🔥" },
  { kind: "heart", emoji: "❤️" },
];

export type FeedItem = {
  id: string;
  authorName: string;
  initials: string;
  color: string;
  activity: string;
  note: string | null;
  photoUrl: string | null;
  timeLabel: string;
  isMine: boolean;
  counts: Record<Kind, number>;
  mine: Record<Kind, boolean>;
};

export default function Feed({
  items,
  userId,
}: {
  items: FeedItem[];
  userId: string;
}) {
  const [state, setState] = useState<
    Record<string, { counts: Record<Kind, number>; mine: Record<Kind, boolean> }>
  >(() => {
    const m: any = {};
    for (const it of items) m[it.id] = { counts: it.counts, mine: it.mine };
    return m;
  });

  async function toggle(id: string, kind: Kind) {
    const cur = state[id];
    if (!cur) return;
    const wasMine = cur.mine[kind];
    setState((prev) => ({
      ...prev,
      [id]: {
        counts: {
          ...prev[id].counts,
          [kind]: prev[id].counts[kind] + (wasMine ? -1 : 1),
        },
        mine: { ...prev[id].mine, [kind]: !wasMine },
      },
    }));
    const supabase = createClient();
    if (wasMine) {
      await supabase
        .from("reactions")
        .delete()
        .eq("session_id", id)
        .eq("user_id", userId)
        .eq("kind", kind);
    } else {
      await supabase
        .from("reactions")
        .insert({ session_id: id, user_id: userId, kind });
    }
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-line bg-card p-8 text-center">
        <div className="text-[32px]">🫛</div>
        <p className="mt-2 font-serif text-[18px] font-semibold text-ink">
          Nothing here yet
        </p>
        <p className="mt-1 text-[15px] text-muted">
          Log a session with the + button to kick off your pod's feed.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => {
        const meta = activityMeta(it.activity);
        const s = state[it.id];
        return (
          <div
            key={it.id}
            className="rounded-2xl border border-line bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
                style={{ backgroundColor: it.color }}
              >
                {it.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] text-ink">
                  <span className="font-semibold">
                    {it.isMine ? "You" : it.authorName}
                  </span>{" "}
                  logged {meta.emoji} {meta.label.toLowerCase()}
                </div>
                <div className="text-[13px] text-muted">{it.timeLabel}</div>
              </div>
            </div>

            {it.note && (
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {it.note}
              </p>
            )}

            {it.photoUrl && (
              <img
                src={it.photoUrl}
                alt=""
                className="mt-3 w-full rounded-xl object-cover"
                style={{ maxHeight: "360px" }}
              />
            )}

            <div className="mt-3 flex items-center gap-2">
              {KINDS.map(({ kind, emoji }) => {
                const active = s?.mine[kind];
                const count = s?.counts[kind] ?? 0;
                return (
                  <button
                    key={kind}
                    onClick={() => toggle(it.id, kind)}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-[15px] transition active:scale-95 ${
                      active
                        ? "border-terra bg-terra/[0.08] font-semibold text-terra"
                        : "border-line bg-paper-2/40 text-muted"
                    }`}
                  >
                    <span>{emoji}</span>
                    {count > 0 && <span>{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
