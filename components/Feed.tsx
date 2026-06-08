"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { activityMeta } from "@/lib/activities";
import SessionEditSheet from "@/components/SessionEditSheet";
import Avatar from "@/components/Avatar";

const REACTIONS: { kind: string; emoji: string }[] = [
  { kind: "clap", emoji: "👏" },
  { kind: "fire", emoji: "🔥" },
  { kind: "heart", emoji: "❤️" },
  { kind: "muscle", emoji: "💪" },
  { kind: "tada", emoji: "🎉" },
];

export type FeedComment = {
  id: string;
  avatarUrl: string | null;
  name: string;
  initials: string;
  color: string;
  body: string;
  timeLabel: string;
  isMine: boolean;
};

export type FeedItem = {
  id: string;
  authorUserId: string;
  avatarUrl: string | null;
  authorName: string;
  initials: string;
  color: string;
  activity: string;
  activities: string[];
  note: string | null;
  photoUrl: string | null;
  timeLabel: string;
  isMine: boolean;
  counts: Record<string, number>;
  mine: Record<string, boolean>;
  comments: FeedComment[];
};

type Me = { userId: string; name: string; initials: string; color: string; avatarUrl: string | null };

export default function Feed({
  items,
  me,
  podId,
}: {
  items: FeedItem[];
  me: Me;
  podId: string;
}) {
  const [feedItems, setFeedItems] = useState<FeedItem[]>(items);
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<FeedItem | null>(null);

  // Re-sync to server truth whenever the page re-fetches (e.g. after you log).
  useEffect(() => {
    setFeedItems(items);
    const r: any = {};
    const c: any = {};
    for (const it of items) {
      r[it.id] = { counts: it.counts, mine: it.mine };
      c[it.id] = it.comments;
    }
    setRstate(r);
    setCstate(c);
  }, [items]);

  // Live updates from everyone else in the pod.
  useEffect(() => {
    const supabase = createClient();
    let channel: any = null;
    let cancelled = false;

    (async () => {
      // Realtime honors RLS: the socket must carry the user's token, or the
      // server treats it as anonymous and silently blocks every event.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`pod-feed-${podId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sessions",
          filter: `pod_id=eq.${podId}`,
        },
        async (payload: any) => {
          const s = payload.new;
          if (!s?.id || s.user_id === me.userId) return; // ours arrives via refresh
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name, initials, avatar_color, avatar_url")
            .eq("id", s.user_id)
            .maybeSingle();
          const item: FeedItem = {
            id: s.id,
            authorUserId: s.user_id,
            authorName: prof?.display_name ?? "Member",
            initials: prof?.initials ?? "?",
            color: prof?.avatar_color ?? "#c8553d",
            avatarUrl: prof?.avatar_url ?? null,
            activity: s.activity ?? "other",
            activities:
              Array.isArray(s.activities) && s.activities.length
                ? s.activities
                : [s.activity ?? "other"],
            note: s.note ?? null,
            photoUrl: s.photo_url ?? null,
            timeLabel: "just now",
            isMine: false,
            counts: {},
            mine: {},
            comments: [],
          };
          setFeedItems((prev) =>
            prev.some((p) => p.id === s.id) ? prev : [item, ...prev]
          );
          setRstate((p) =>
            p[s.id] ? p : { ...p, [s.id]: { counts: {}, mine: {} } }
          );
          setCstate((c) => (c[s.id] ? c : { ...c, [s.id]: [] }));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions" },
        (payload: any) => {
          const s = payload.new;
          if (!s?.id || s.user_id === me.userId) return; // ours updates locally
          setFeedItems((prev) =>
            prev.map((p) =>
              p.id === s.id
                ? {
                    ...p,
                    activity: s.activity ?? "other",
                    activities:
                      Array.isArray(s.activities) && s.activities.length
                        ? s.activities
                        : [s.activity ?? "other"],
                    note: s.note ?? null,
                    photoUrl: s.photo_url ?? null,
                  }
                : p
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions" },
        async (payload: any) => {
          const row =
            payload.new && Object.keys(payload.new).length
              ? payload.new
              : payload.old;
          const sid = row?.session_id;
          if (!sid) return;
          // Recompute this post's reactions from the source of truth — avoids
          // any drift from overlapping live events and optimistic updates.
          const { data: rows } = await supabase
            .from("reactions")
            .select("user_id, kind")
            .eq("session_id", sid);
          setRstate((prev) => {
            if (!prev[sid]) return prev;
            const counts: Record<string, number> = {};
            const mine: Record<string, boolean> = {};
            (rows ?? []).forEach((r: any) => {
              counts[r.kind] = (counts[r.kind] ?? 0) + 1;
              if (r.user_id === me.userId) mine[r.kind] = true;
            });
            return { ...prev, [sid]: { counts, mine } };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments" },
        async (payload: any) => {
          const c = payload.new;
          if (!c?.id || c.user_id === me.userId) return;
          const { data: p } = await supabase
            .from("profiles")
            .select("display_name, initials, avatar_color, avatar_url")
            .eq("id", c.user_id)
            .maybeSingle();
          setCstate((prev) => {
            if (!prev[c.session_id]) return prev;
            if (prev[c.session_id].some((x) => x.id === c.id)) return prev;
            const nc: FeedComment = {
              id: c.id,
              name: p?.display_name ?? "Member",
              initials: p?.initials ?? "?",
              color: p?.avatar_color ?? "#c8553d",
              avatarUrl: p?.avatar_url ?? null,
              body: c.body,
              timeLabel: "just now",
              isMine: false,
            };
            return { ...prev, [c.session_id]: [...prev[c.session_id], nc] };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "comments" },
        (payload: any) => {
          const c = payload.new;
          if (!c?.id || c.user_id === me.userId) return;
          setCstate((prev) => {
            const list = prev[c.session_id];
            if (!list) return prev;
            return {
              ...prev,
              [c.session_id]: list.map((x) =>
                x.id === c.id ? { ...x, body: c.body } : x
              ),
            };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments" },
        (payload: any) => {
          const id = payload.old?.id;
          if (!id) return;
          // We may not get session_id on delete, so remove the id wherever it is.
          setCstate((prev) => {
            let changed = false;
            const next: Record<string, FeedComment[]> = {};
            for (const sid of Object.keys(prev)) {
              const filtered = prev[sid].filter((x) => x.id !== id);
              if (filtered.length !== prev[sid].length) changed = true;
              next[sid] = filtered;
            }
            return changed ? next : prev;
          });
        }
      )
        .subscribe((status: string) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("pod feed realtime:", status);
          }
        });
    })();

    // Keep the socket authed if the access token refreshes mid-session.
    const { data: authSub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [podId, me.userId]);

  async function react(id: string, kind: string) {
    const cur = rstate[id];
    if (!cur) return;
    const had = !!cur.mine[kind];
    const myKind = Object.keys(cur.mine).find((k) => cur.mine[k]);
    // One reaction per person per post: switch, or tap again to remove.
    setRstate((p) => {
      const counts = { ...p[id].counts };
      if (had) {
        counts[kind] = Math.max(0, (counts[kind] ?? 0) - 1);
        return { ...p, [id]: { counts, mine: {} } };
      }
      if (myKind && myKind !== kind) {
        counts[myKind] = Math.max(0, (counts[myKind] ?? 0) - 1);
      }
      counts[kind] = (counts[kind] ?? 0) + 1;
      return { ...p, [id]: { counts, mine: { [kind]: true } } };
    });
    const supabase = createClient();
    await supabase
      .from("reactions")
      .delete()
      .eq("session_id", id)
      .eq("user_id", me.userId);
    if (!had) {
      await supabase
        .from("reactions")
        .insert({ session_id: id, user_id: me.userId, kind });
      // Ping the pod about the cheer (skip your own logs; only on new cheers).
      const item = items.find((x) => x.id === id);
      if (item && !item.isMine) {
        const emoji = REACTIONS.find((r) => r.kind === kind)?.emoji ?? "👏";
        fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "reaction",
            podId,
            authorUserId: item.authorUserId,
            emoji,
            url: "/app",
          }),
        }).catch(() => {});
      }
    }
  }

  function startEdit(c: FeedComment) {
    setEditingId(c.id);
    setEditDraft(c.body);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }
  async function saveEdit(sessionId: string, commentId: string) {
    const body = editDraft.trim();
    if (!body) return;
    setCstate((c) => ({
      ...c,
      [sessionId]: (c[sessionId] ?? []).map((x) =>
        x.id === commentId ? { ...x, body } : x
      ),
    }));
    setEditingId(null);
    const supabase = createClient();
    await supabase.from("comments").update({ body }).eq("id", commentId);
  }
  async function deleteComment(sessionId: string, commentId: string) {
    setCstate((c) => ({
      ...c,
      [sessionId]: (c[sessionId] ?? []).filter((x) => x.id !== commentId),
    }));
    const supabase = createClient();
    await supabase.from("comments").delete().eq("id", commentId);
  }

  async function addComment(id: string) {
    const body = (draft[id] ?? "").trim();
    if (!body) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    // Show it immediately, then reconcile with the server.
    setCstate((c) => ({
      ...c,
      [id]: [
        ...(c[id] ?? []),
        {
          id: tempId,
          name: me.name,
          initials: me.initials,
          color: me.color,
          avatarUrl: me.avatarUrl,
          body,
          timeLabel: "just now",
          isMine: true,
        },
      ],
    }));
    setDraft((d) => ({ ...d, [id]: "" }));
    setBusy((b) => ({ ...b, [id]: true }));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comments")
      .insert({ session_id: id, user_id: me.userId, body })
      .select("id")
      .single();
    setBusy((b) => ({ ...b, [id]: false }));
    if (error) {
      // roll back and give them their text back
      setCstate((c) => ({
        ...c,
        [id]: (c[id] ?? []).filter((x) => x.id !== tempId),
      }));
      setDraft((d) => ({ ...d, [id]: body }));
      return;
    }
    if (data?.id) {
      setCstate((c) => ({
        ...c,
        [id]: (c[id] ?? []).map((x) =>
          x.id === tempId ? { ...x, id: data.id } : x
        ),
      }));
    }
    // Ping the pod about the comment (skip your own logs).
    const item = items.find((x) => x.id === id);
    if (item && !item.isMine) {
      fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "comment",
          podId,
          authorUserId: item.authorUserId,
          url: "/app",
        }),
      }).catch(() => {});
    }
  }

  if (feedItems.length === 0) {
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
      {feedItems.map((it) => {
        const metas = (it.activities?.length ? it.activities : [it.activity]).map(
          (k) => activityMeta(k)
        );
        const activityLabel = metas
          .map((m) => `${m.emoji} ${m.label.toLowerCase()}`)
          .join(" + ");
        const comments = cstate[it.id] ?? [];
        const isOpen = open[it.id];
        return (
          <div key={it.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center gap-3">
              <Avatar
                url={it.avatarUrl}
                initials={it.initials}
                color={it.color}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] text-ink">
                  <span className="font-semibold">
                    {it.isMine ? "You" : it.authorName}
                  </span>{" "}
                  logged {activityLabel}
                </div>
                <div className="text-[13px] text-muted">{it.timeLabel}</div>
              </div>
              {it.isMine && (
                <button
                  onClick={() => setEditing(it)}
                  className="shrink-0 self-start text-[13px] font-semibold text-muted"
                >
                  Edit
                </button>
              )}
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
                      <Avatar
                        url={c.avatarUrl}
                        initials={c.initials}
                        color={c.color}
                        size={28}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px]">
                          <span className="font-semibold text-ink">
                            {c.isMine ? "You" : c.name}
                          </span>{" "}
                          <span className="text-muted">{c.timeLabel}</span>
                        </div>
                        {editingId === c.id ? (
                          <div className="mt-1">
                            <input
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && saveEdit(it.id, c.id)
                              }
                              autoFocus
                              maxLength={300}
                              className="w-full rounded-lg border border-line bg-paper-2/40 px-2.5 py-1.5 text-[15px] text-ink outline-none focus:border-terra"
                            />
                            <div className="mt-1.5 flex gap-2">
                              <button
                                onClick={() => saveEdit(it.id, c.id)}
                                className="rounded-lg bg-ink px-3 py-1 text-[12px] font-semibold text-paper"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="rounded-lg bg-paper-2 px-3 py-1 text-[12px] font-semibold text-muted"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-[15px] leading-snug text-ink-soft">
                              {c.body}
                            </div>
                            {c.isMine &&
                              (confirmDelete === c.id ? (
                                <div className="mt-1 flex items-center gap-3">
                                  <span className="text-[12px] text-muted">
                                    Delete this comment?
                                  </span>
                                  <button
                                    onClick={() => {
                                      setConfirmDelete(null);
                                      deleteComment(it.id, c.id);
                                    }}
                                    className="text-[12px] font-semibold text-terra"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="text-[12px] font-semibold text-muted"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-0.5 flex gap-3">
                                  <button
                                    onClick={() => startEdit(c)}
                                    className="text-[12px] font-semibold text-muted"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(c.id)}
                                    className="text-[12px] font-semibold text-muted"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ))}
                          </>
                        )}
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

      {editing && (
        <SessionEditSheet
          session={{
            id: editing.id,
            activities: editing.activities?.length
              ? editing.activities
              : [editing.activity],
            note: editing.note,
            photoUrl: editing.photoUrl,
          }}
          podId={podId}
          userId={me.userId}
          onClose={() => setEditing(null)}
          onSaved={(fields) => {
            setFeedItems((prev) =>
              prev.map((p) =>
                p.id === editing.id
                  ? {
                      ...p,
                      activities: fields.activities,
                      activity: fields.activities[0] ?? p.activity,
                      note: fields.note,
                      photoUrl: fields.photoUrl,
                    }
                  : p
              )
            );
          }}
        />
      )}
    </div>
  );
}
