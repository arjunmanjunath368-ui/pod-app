"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { activityMeta } from "@/lib/activities";

const REACTIONS: { kind: string; emoji: string }[] = [
  { kind: "clap", emoji: "👏" },
  { kind: "fire", emoji: "🔥" },
  { kind: "heart", emoji: "❤️" },
  { kind: "muscle", emoji: "💪" },
  { kind: "tada", emoji: "🎉" },
];

export type FeedComment = {
  id: string;
  name: string;
  initials: string;
  color: string;
  body: string;
  timeLabel: string;
  isMine: boolean;
};

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
  counts: Record<string, number>;
  mine: Record<string, boolean>;
  comments: FeedComment[];
};

type Me = { userId: string; name: string; initials: string; color: string };

export default function Feed({ items, me }: { items: FeedItem[]; me: Me }) {
  const [rstate, setRstate] = useState<
    Record<string, { counts: Record<string, number>; mine: Record<string, boolean> }>
  >(() => {
    const m: any = {};
    for (const it of items) m[it.id] = { counts: it.counts, mine: it.mine };
    return m;
  });
  const [cstate, setCstate] = useState<Record<string, FeedComment[]>>(() => {
    const m: any = {};
    for (const it of items) m[it.id] = it.comments;
    return m;
  });
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function react(id: string, kind: string) {
    const cur = rstate[id];
    if (!cur) return;
    const was = cur.mine[kind];
    setRstate((p) => ({
      ...p,
      [id]: {
        counts: { ...p[id].counts, [kind]: (p[id].counts[kind] ?? 0) + (was ? -1 : 1) },
        mine: { ...p[id].mine, [kind]: !was },
      },
    }));
    const supabase = createClient();
    if (was) {
      await supabase
        .from("reactions")
        .delete()
        .eq("session_id", id)
        .eq("user_id", me.userId)
        .eq("kind", kind);
    } else {
      await supabase
        .from("reactions")
        .insert({ session_id: id, user_id: me.userId, kind });
    }
  }

  async function addComment(id: string) {
    const body = (draft[id] ?? "").trim();
    if (!body) return;
    setBusy((b) => ({ ...b, [id]: true }));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comments")
      .insert({ session_id: id, user_id: me.userId, body })
      .select("id")
      .single();
    setBusy((b) => ({ ...b, [id]: false }));
    if (error) return;
    const newC: FeedComment = {
      id: data?.id ?? crypto.randomUUID(),
      name: me.name,
      initials: me.initials,
      color: me.color,
      body,
      timeLabel: "just now",
      isMine: true,
    };
    setCstate((c) => ({ ...c, [id]: [...(c[id] ?? []), newC] }));
    setDraft((d) => ({ ...d, [id]: "" }));
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
        const comments = cstate[it.id] ?? [];
        const isOpen = open[it.id];
        return (
          <div key={it.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
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

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {REACTIONS.map(({ kind, emoji }) => {
                const active = rstate[it.id]?.mine[kind];
                const count = rstate[it.id]?.counts[kind] ?? 0;
                return (
                  <button
                    key={kind}
                    onClick={() => react(it.id, kind)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[14px] transition active:scale-95 ${
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

            {/* Comments */}
            <button
              onClick={() => setOpen((o) => ({ ...o, [it.id]: !o[it.id] }))}
              className="mt-3 flex items-center gap-1.5 text-[14px] font-semibold text-muted"
            >
              💬{" "}
              {comments.length > 0
                ? `${comments.length} ${
                    comments.length === 1 ? "comment" : "comments"
                  }`
                : "Comment"}
            </button>

            {isOpen && (
              <div className="mt-3 border-t border-line pt-3">
                <div className="flex flex-col gap-3">
                  {comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px]">
                          <span className="font-semibold text-ink">
                            {c.isMine ? "You" : c.name}
                          </span>{" "}
                          <span className="text-muted">{c.timeLabel}</span>
                        </div>
                        <div className="text-[15px] leading-snug text-ink-soft">
                          {c.body}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={draft[it.id] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [it.id]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && addComment(it.id)}
                    placeholder="Add a comment…"
                    maxLength={300}
                    className="min-w-0 flex-1 rounded-xl border border-line bg-paper-2/40 px-3 py-2 text-[15px] text-ink outline-none focus:border-terra"
                  />
                  <button
                    onClick={() => addComment(it.id)}
                    disabled={busy[it.id] || !(draft[it.id] ?? "").trim()}
                    className="rounded-xl bg-ink px-4 py-2 text-[14px] font-semibold text-paper transition active:scale-95 disabled:opacity-50"
                  >
                    Post
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
