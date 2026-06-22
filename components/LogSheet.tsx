"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITIES, activityMeta, type ActivityKey } from "@/lib/activities";
import { parseGoal, goalHit } from "@/lib/goals";
import { weekStartUtc } from "@/lib/week";
import { enablePush, pushSupported, isIOS, isStandalone } from "@/lib/push";
import LiveCamera from "@/components/LiveCamera";

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
  // Per-activity detail when more than one activity is logged together.
  const [actNotes, setActNotes] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [primer, setPrimer] = useState(false);
  const [primerBusy, setPrimerBusy] = useState(false);

  // Soft pre-permission prompt: only worth showing where push can actually work
  // and the user hasn't decided yet (granted/denied → never re-ask here), and
  // not again for a few days after they've seen it.
  function shouldPrime(): boolean {
    if (typeof window === "undefined") return false;
    if (!pushSupported()) return false;
    if (isIOS() && !isStandalone()) return false;
    if (typeof Notification === "undefined") return false;
    if (Notification.permission !== "default") return false;
    try {
      const last = Number(localStorage.getItem("pod_notif_primer_at") || 0);
      if (last && Date.now() - last < 3 * 24 * 60 * 60 * 1000) return false;
    } catch {}
    return true;
  }

  function markPrimerSeen() {
    try {
      localStorage.setItem("pod_notif_primer_at", String(Date.now()));
    } catch {}
  }
  const [pods, setPods] = useState<{ id: string; name: string }[]>([]);
  const [selectedPods, setSelectedPods] = useState<string[]>([podId]);
  // Pods (of this user's) that currently have stakes running. Logging into any
  // of these requires a live in-app photo to count toward the wager.
  const [stakedPodIds, setStakedPodIds] = useState<Set<string>>(new Set());
  const [cameraOpen, setCameraOpen] = useState(false);
  // True only when the attached photo came from the live camera (not gallery).
  const [liveVerified, setLiveVerified] = useState(false);
  // Set when the camera couldn't run — unlocks the unverified fallback so an OS
  // quirk never blocks logging an actual workout.
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedPods([podId]);
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

      const ids = list.map((p: any) => p.id);
      if (ids.length) {
        const { data: stakes } = await supabase
          .from("pod_stakes")
          .select("pod_id, status")
          .in("pod_id", ids)
          .eq("status", "active");
        setStakedPodIds(
          new Set((stakes ?? []).map((s: any) => s.pod_id as string))
        );
      } else {
        setStakedPodIds(new Set());
      }
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
    setLiveVerified(false);
    setCameraError("");
  }

  // A live photo came back from the camera overlay.
  function onLiveCapture(file: File, dataUrl: string) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(dataUrl);
    setLiveVerified(true);
    setCameraError("");
    setCameraOpen(false);
  }

  // Camera couldn't run — surface the unverified fallback.
  function onLiveError(message: string) {
    setCameraOpen(false);
    setLiveVerified(false);
    setCameraError(message);
  }

  function togglePod(id: string) {
    setSelectedPods((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      return next.length ? next : prev; // always at least one
    });
  }

  function finishCelebration() {
    setCelebration(null);
    setDone(false);
    if (shouldPrime()) {
      markPrimerSeen();
      setPrimer(true);
      return; // primer handles closing
    }
    setNote("");
    setActNotes({});
    clearPhoto();
    onClose();
    router.refresh();
  }

  function closeAfterPrimer() {
    setPrimer(false);
    setNote("");
    setActNotes({});
    clearPhoto();
    onClose();
    router.refresh();
  }

  async function primerTurnOn() {
    if (primerBusy) return;
    setPrimerBusy(true);
    try {
      await enablePush(userId);
    } catch {}
    setPrimerBusy(false);
    closeAfterPrimer();
  }

  async function logIt() {
    if (activities.length === 0) {
      setError("Pick at least one activity.");
      return;
    }
    // Staked pods need a live photo. If one's selected and there's no live
    // photo yet, route to the camera instead of saving — unless the camera
    // already failed, in which case "Log it" means an explicit unverified save.
    const stakedSelected = selectedPods.filter((id) => stakedPodIds.has(id));
    if (stakedSelected.length > 0 && !liveVerified && !cameraError) {
      setError("");
      setCameraOpen(true);
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();

    let photoUrl: string | null = null;
    if (photo) {
      const blob = await compressToJpeg(photo);
      const path = `${selectedPods[0]}/${userId}/${crypto.randomUUID()}.jpg`;
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

    // One session row per pod the log applies to.
    const multi = activities.length > 1;
    const activityNotes: Record<string, string> = {};
    if (multi) {
      for (const a of activities) {
        const v = (actNotes[a] ?? "").trim();
        if (v) activityNotes[a] = v;
      }
    }
    const hasActNotes = Object.keys(activityNotes).length > 0;

    const { error } = await supabase.from("sessions").insert(
      selectedPods.map((pid) => ({
        pod_id: pid,
        user_id: userId,
        activity: activities[0],
        activities,
        note: multi ? null : note.trim() || null,
        activity_notes: hasActNotes ? activityNotes : null,
        photo_url: photoUrl,
        // Only staked pods care about verification. A staked row counts toward
        // the wager only when a live photo backs it; otherwise it's unverified.
        verified: stakedPodIds.has(pid) ? liveVerified : true,
      }))
    );
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }

    // Tell each pod someone showed up (best-effort; never blocks the log).
    const activityLabel = activities
      .map((k) => activityMeta(k).label.toLowerCase())
      .join(" + ");
    selectedPods.forEach((pid) => {
      fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podId: pid, activityLabel, url: "/app" }),
      }).catch(() => {});
    });

    // Clear any open challenges these logs answer, and ping whoever sent them.
    try {
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      const { data: openCh } = await supabase
        .from("challenges")
        .select("id, from_user")
        .eq("to_user", userId)
        .eq("status", "active")
        .gte("due_date", todayStr)
        .in("pod_id", selectedPods);
      if (openCh && openCh.length) {
        await supabase
          .from("challenges")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .in(
            "id",
            openCh.map((c: any) => c.id)
          );
        const senders = Array.from(
          new Set(openCh.map((c: any) => c.from_user))
        );
        senders.forEach((sid) => {
          fetch("/api/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toUserId: sid,
              kind: "challenge_done",
              url: "/app",
            }),
          }).catch(() => {});
        });
      }
    } catch {}

    // Celebrate against the pod you opened the log from (or the first selected).
    const primaryPod = selectedPods.includes(podId) ? podId : selectedPods[0];
    let cel: Celebration | null = null;
    try {
      cel = await computeCelebration(
        supabase,
        primaryPod,
        userId,
        activities[0] ?? null
      );
    } catch {
      cel = null;
    }
    if (cel) {
      setCelebration(cel); // wait for the user to dismiss
      return;
    }

    if (shouldPrime()) {
      markPrimerSeen();
      setPrimer(true); // primer handles closing
      return;
    }

    setDone(true);
    setTimeout(() => {
      setDone(false);
      setNote("");
    setActNotes({});
      clearPhoto();
      onClose();
      router.refresh();
    }, 900);
  }

  const stakedSelectedNames = pods
    .filter((p) => selectedPods.includes(p.id) && stakedPodIds.has(p.id))
    .map((p) => p.name);
  const requiresLivePhoto = stakedSelectedNames.length > 0;
  const stakedWhy =
    stakedSelectedNames.length === 1
      ? `${stakedSelectedNames[0]} has stakes on`
      : `${stakedSelectedNames.length} of your pods have stakes on`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={() => !saving && !celebration && !primer && onClose()}
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
        ) : primer ? (
          <div className="py-6 text-center">
            <div className="text-[44px]">🔔</div>
            <h2 className="mt-2 font-serif text-[23px] font-semibold leading-tight text-ink">
              Want your pod to cheer you on?
            </h2>
            <p className="mx-auto mt-2 max-w-[300px] text-[15px] leading-relaxed text-muted">
              Turn on notifications and you'll know the moment a teammate shows
              up or cheers your workout — and they'll feel it when you do.
            </p>
            <button
              onClick={primerTurnOn}
              disabled={primerBusy}
              className="mt-6 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {primerBusy ? "Turning on…" : "Turn on notifications"}
            </button>
            <button
              onClick={closeAfterPrimer}
              disabled={primerBusy}
              className="mt-3 w-full text-center text-[14px] font-semibold text-muted disabled:opacity-60"
            >
              Maybe later
            </button>
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
                  Log to
                </div>
                <div className="flex flex-wrap gap-2">
                  {pods.map((p) => {
                    const on = selectedPods.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePod(p.id)}
                        aria-pressed={on}
                        className={`rounded-full border px-3 py-1.5 text-[14px] font-semibold transition active:scale-95 ${
                          on
                            ? "border-terra bg-terra/[0.08] text-terra"
                            : "border-line bg-card text-ink-soft"
                        }`}
                      >
                        {on ? "✓ " : ""}
                        {p.name}
                      </button>
                    );
                  })}
                </div>
                {selectedPods.length > 1 && (
                  <p className="mt-2 text-[12px] text-muted">
                    This session will count in {selectedPods.length} pods.
                  </p>
                )}
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

            {activities.length > 1 ? (
              <div className="mt-4 space-y-2.5">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                  Notes per activity (optional)
                </div>
                {activities.map((a) => {
                  const meta = activityMeta(a);
                  return (
                    <input
                      key={a}
                      value={actNotes[a] ?? ""}
                      onChange={(e) =>
                        setActNotes((prev) => ({ ...prev, [a]: e.target.value }))
                      }
                      maxLength={140}
                      placeholder={`${meta.emoji} ${meta.label} — how'd it go?`}
                      className="w-full min-w-0 box-border rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:border-terra"
                    />
                  );
                })}
              </div>
            ) : (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional) — how'd it go?"
                rows={2}
                maxLength={140}
                className="mt-4 w-full resize-none rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-terra"
              />
            )}

            {preview ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5">
                <img
                  src={preview}
                  alt=""
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <span className="flex-1 text-[15px] text-muted">
                  {liveVerified ? (
                    <span className="font-semibold text-sage">
                      ✓ Live photo — verified
                    </span>
                  ) : (
                    "Photo attached"
                  )}
                </span>
                <button
                  onClick={clearPhoto}
                  className="rounded-full bg-paper-2 px-3 py-1.5 text-[13px] font-semibold text-muted"
                >
                  Remove
                </button>
              </div>
            ) : requiresLivePhoto ? (
              <div className="mt-3">
                <button
                  onClick={() => {
                    setCameraError("");
                    setCameraOpen(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-terra bg-terra/10 py-3 text-[15px] font-semibold text-terra"
                >
                  <span className="text-[16px]">📸</span> Take live photo
                </button>
                <p className="mt-2 text-[12px] leading-relaxed text-muted">
                  🎯 {stakedWhy} — log it with a live photo so it counts toward
                  the stake. No camera roll.
                </p>
                {cameraError && (
                  <div className="mt-2 rounded-xl border border-line bg-paper-2/60 p-3">
                    <p className="text-[13px] leading-relaxed text-ink-soft">
                      Couldn&apos;t open the camera. You can still log this — it
                      just won&apos;t count toward your stake until you re-log
                      with a photo.
                    </p>
                  </div>
                )}
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
              {saving
                ? "Logging…"
                : requiresLivePhoto && !liveVerified && !cameraError
                  ? "📸 Take live photo to log"
                  : requiresLivePhoto && !liveVerified && cameraError
                    ? "Log without verifying"
                    : "Log it"}
            </button>
          </>
        )}
      </div>

      <LiveCamera
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={onLiveCapture}
        onError={onLiveError}
      />
    </div>
  );
}
