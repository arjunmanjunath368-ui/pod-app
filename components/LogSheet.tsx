"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITIES, activityMeta, type ActivityKey } from "@/lib/activities";
import { parseGoal, goalHit } from "@/lib/goals";
import { weekStartUtc } from "@/lib/week";

type Celebration = { tier: "perfect" | "goal"; detail: string };

async function compressToJpeg(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1200;
    let { width, height } = bitmap;
    if (width >= height && width > maxDim) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else if (height > maxDim) {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.8)
    );
  } catch {
    return file; // fallback: upload original (e.g. unsupported decode)
  }
}

// Did THIS log just cross a milestone? Runs against the source of truth right
// after the insert, so it only fires on the session that tips you over.
async function computeCelebration(
  supabase: ReturnType<typeof createClient>,
  podId: string,
  userId: string,
  loggedActivity: string | null
): Promise<Celebration | null> {
  const { data: pod } = await supabase
    .from("pods")
    .select("name, timezone, week_starts_on")
    .eq("id", podId)
    .maybeSingle();
  if (!pod) return null;

  const tz = pod.timezone || "UTC";
  const weekStartsOn = pod.week_starts_on ?? 1;
  const weekStartInstant = weekStartUtc(tz, weekStartsOn);
  const weekStart = weekStartInstant.toISOString();
  const weekStartMs = weekStartInstant.getTime();

  const { data: meMem } = await supabase
    .from("pod_members")
    .select(
      "joined_at, goal_activity, goal_target_per_week, goal_mode, goal_activities, goal_splits"
    )
    .eq("pod_id", podId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!meMem) return null;
  const myGoal = parseGoal(meMem);
  if (!myGoal.hasGoal) return null;
  // Mid-week joiner: weekly goal hasn't started yet, so no weekly celebration.
  if (meMem.joined_at && new Date(meMem.joined_at).getTime() > weekStartMs)
    return null;

  const { data: weekSessions } = await supabase
    .from("sessions")
    .select("user_id, activity")
    .eq("pod_id", podId)
    .gte("logged_at", weekStart);
  const byUser: Record<string, { activity: string | null }[]> = {};
  (weekSessions ?? []).forEach((s: any) => {
    (byUser[s.user_id] ??= []).push({ activity: s.activity ?? null });
  });
  const mine = byUser[userId] ?? [];

  // Celebrate only on the session that tips you over: hit now, but not hit if
  // you back out the one we just logged. Works for combined and split alike.
  if (!goalHit(myGoal, mine)) return null;
  const idx = mine.findIndex((s) => s.activity === loggedActivity);
  const without =
    idx >= 0 ? mine.filter((_, i) => i !== idx) : mine.slice(0, -1);
  if (goalHit(myGoal, without)) return null;

  // Perfect week: every active member with a goal has met it.
  const { data: members } = await supabase
    .from("pod_members")
    .select(
      "user_id, joined_at, goal_activity, goal_target_per_week, goal_mode, goal_activities, goal_splits, status"
    )
    .eq("pod_id", podId)
    .neq("status", "left");
  const goalMembers = (members ?? []).filter(
    (m: any) =>
      m.status === "active" &&
      parseGoal(m).hasGoal &&
      !(m.joined_at && new Date(m.joined_at).getTime() > weekStartMs)
  );
  const allHit =
    goalMembers.length > 1 &&
    goalMembers.every((m: any) => goalHit(parseGoal(m), byUser[m.user_id] ?? []));

  if (allHit) {
    return {
      tier: "perfect",
      detail: `Everyone in ${pod.name} hit their goal this week.`,
    };
  }
  return {
    tier: "goal",
    detail:
      myGoal.mode === "split"
        ? "You hit every target this week. You showed up."
        : `That's ${myGoal.target} of ${myGoal.target} this week. You showed up.`,
  };
}

export default function LogSheet({
  open,
  onClose,
  podId,
  userId,
  defaultActivity,
}: {
  open: boolean;
  onClose: () => void;
  podId: string;
  userId: string;
  defaultActivity?: ActivityKey;
}) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityKey[]>(
    defaultActivity ? [defaultActivity] : []
  );
  function toggleActivity(key: ActivityKey) {
    setActivities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [pods, setPods] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState(podId);

  useEffect(() => {
    if (!open) return;
    setSelected(podId);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("pod_members")
        .select("pod_id, pods(name)")
        .eq("user_id", userId)
        .neq("status", "left");
      const list = (data ?? [])
        .map((m: any) => ({
          id: m.pod_id as string,
          name: (Array.isArray(m.pods) ? m.pods[0] : m.pods)?.name as string,
        }))
        .filter((p: any) => p.name);
      setPods(list);
    })();
  }, [open, podId, userId]);

  if (!open) return null;

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearPhoto() {
    setPhoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  function finishCelebration() {
    setCelebration(null);
    setDone(false);
    setNote("");
    clearPhoto();
    onClose();
    router.refresh();
  }

  async function logIt() {
    if (activities.length === 0) {
      setError("Pick at least one activity.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();

    let photoUrl: string | null = null;
    if (photo) {
      const blob = await compressToJpeg(photo);
      const path = `${selected}/${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("session-photos")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (upErr) {
        setSaving(false);
        setError("Photo upload failed: " + upErr.message);
        return;
      }
      photoUrl = supabase.storage.from("session-photos").getPublicUrl(path)
        .data.publicUrl;
    }

    const { error } = await supabase.from("sessions").insert({
      pod_id: selected,
      user_id: userId,
      activity: activities[0],
      activities,
      note: note.trim() || null,
      photo_url: photoUrl,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }

    // Tell the pod someone showed up (best-effort; never blocks the log).
    const activityLabel = activities
      .map((k) => activityMeta(k).label.toLowerCase())
      .join(" + ");
    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId: selected, activityLabel, url: "/app" }),
    }).catch(() => {});

    // Did this one cross a milestone?
    let cel: Celebration | null = null;
    try {
      cel = await computeCelebration(supabase, selected, userId, activities[0] ?? null);
    } catch {
      cel = null;
    }
    if (cel) {
      setCelebration(cel); // wait for the user to dismiss
      return;
    }

    setDone(true);
    setTimeout(() => {
      setDone(false);
      setNote("");
      clearPhoto();
      onClose();
      router.refresh();
    }, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={() => !saving && !celebration && onClose()}
      />
      <div className="sheet-enter relative w-full max-w-[420px] rounded-t-[28px] bg-paper px-6 pb-9 pt-3 shadow-pod-lg">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" />

        {celebration ? (
          <div className="py-8 text-center">
            {celebration.tier === "perfect" ? (
              <>
                <div className="mb-3 flex justify-center gap-1.5 text-[36px]">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>
                    🎉
                  </span>
                  <span
                    className="animate-bounce"
                    style={{ animationDelay: "120ms" }}
                  >
                    🔥
                  </span>
                  <span
                    className="animate-bounce"
                    style={{ animationDelay: "240ms" }}
                  >
                    🎉
                  </span>
                </div>
                <p className="font-serif text-[27px] font-semibold leading-tight text-ink">
                  Perfect week!
                </p>
              </>
            ) : (
              <>
                <div className="text-[46px]">🎯</div>
                <p className="mt-2 font-serif text-[25px] font-semibold leading-tight text-ink">
                  You hit your goal!
                </p>
              </>
            )}
            <p className="mx-auto mt-2 max-w-[300px] text-[15px] leading-relaxed text-muted">
              {celebration.detail}
            </p>
            <button
              onClick={finishCelebration}
              className="mt-6 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98]"
            >
              {celebration.tier === "perfect" ? "Let's gooo" : "Nice!"}
            </button>
          </div>
        ) : done ? (
          <div className="py-8 text-center">
            <div className="text-[40px]">✅</div>
            <p className="mt-2 font-serif text-[22px] font-semibold text-ink">
              Logged. Nice.
            </p>
            <p className="mt-1 text-[15px] text-muted">
              Your pod sees you showed up.
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-[22px] font-semibold text-ink">
              Log a session
            </h2>
            <p className="mt-1 text-[15px] text-muted">
              What did you do? This counts toward your week.
            </p>

            {pods.length > 1 && (
              <div className="mt-4">
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                  Which pod?
                </div>
                <div className="flex flex-wrap gap-2">
                  {pods.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className={`rounded-full border px-3 py-1.5 text-[14px] font-semibold transition active:scale-95 ${
                        selected === p.id
                          ? "border-terra bg-terra/[0.08] text-terra"
                          : "border-line bg-card text-ink-soft"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {ACTIVITIES.map((a) => {
                const on = activities.includes(a.key);
                return (
                  <button
                    key={a.key}
                    onClick={() => toggleActivity(a.key)}
                    aria-pressed={on}
                    className={`relative flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition ${
                      on
                        ? "border-terra bg-terra/[0.06]"
                        : "border-line bg-card"
                    }`}
                  >
                    {on && (
                      <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-terra text-[10px] font-bold text-white">
                        ✓
                      </span>
                    )}
                    <span className="text-[22px]">{a.emoji}</span>
                    <span className="text-[13px] font-semibold text-ink">
                      {a.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional) — how'd it go?"
              rows={2}
              maxLength={140}
              className="mt-4 w-full resize-none rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-terra"
            />

            {preview ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5">
                <img
                  src={preview}
                  alt=""
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <span className="flex-1 text-[15px] text-muted">
                  Photo attached
                </span>
                <button
                  onClick={clearPhoto}
                  className="rounded-full bg-paper-2 px-3 py-1.5 text-[13px] font-semibold text-muted"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-card py-3 text-[15px] font-semibold text-ink-soft">
                <span className="text-[16px]">📷</span> Add a photo (optional)
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={pickPhoto}
                />
              </label>
            )}

            {error && <p className="mt-3 text-[13px] text-terra">{error}</p>}

            <button
              onClick={logIt}
              disabled={saving || activities.length === 0}
              className="mt-4 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? "Logging…" : "Log it"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
