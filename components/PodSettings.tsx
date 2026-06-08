"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { shortDate } from "@/lib/days";

export default function PodSettings({
  podId,
  userId,
  initialStatus,
  podName,
  displayName,
  stakesActive,
  currentWeekStart,
  nextWeekStart,
  initialPauseUntil,
}: {
  podId: string;
  userId: string;
  initialStatus: string;
  podName: string;
  displayName: string;
  stakesActive: boolean;
  currentWeekStart: string;
  nextWeekStart: string;
  initialPauseUntil?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pauseUntil, setPauseUntil] = useState(initialPauseUntil ?? "");
  const [busy, setBusy] = useState(false);

  async function setMembership(next: "active" | "paused" | "left") {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("pod_members")
      .update({ status: next })
      .eq("pod_id", podId)
      .eq("user_id", userId);
    setBusy(false);
    if (error) return;
    if (next === "left") {
      router.push("/app");
      router.refresh();
      return;
    }
    setStatus(next);
    router.refresh();
  }

  // Pause, optionally telling the pod when you expect to be back. No minimum —
  // any future date (or none) is allowed.
  async function pause() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("pod_members")
      .update({ status: "paused", pause_until: pauseUntil || null })
      .eq("pod_id", podId)
      .eq("user_id", userId);
    setBusy(false);
    if (error) return;
    setStatus("paused");
    router.refresh();
  }

  // Update just the expected-return date while still paused.
  async function updateEta() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("pod_members")
      .update({ pause_until: pauseUntil || null })
      .eq("pod_id", podId)
      .eq("user_id", userId);
    setBusy(false);
    if (error) return;
    router.refresh();
  }

  // Resume, choosing when stakes pick you back up: this week ("join now") or the
  // next full week. staked_from gates the live week in the stakes engine. The
  // expected-return date is cleared once you're back.
  async function resume(stakedFrom: string | null) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("pod_members")
      .update({ status: "active", staked_from: stakedFrom, pause_until: null })
      .eq("pod_id", podId)
      .eq("user_id", userId);
    setBusy(false);
    if (error) return;
    setStatus("active");
    setPauseUntil("");
    router.refresh();
  }

  const msPerDay = 86400000;
  const daysLeftThisWeek = Math.max(
    1,
    7 -
      Math.round(
        (new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime() -
          new Date(currentWeekStart + "T00:00:00Z").getTime()) /
          msPerDay
      )
  );

  function leave() {
    if (
      confirm(
        `Leave "${podName}"? You'll stop appearing in this pod. You can rejoin later with the invite code.`
      )
    ) {
      setMembership("left");
    }
  }

  const paused = status === "paused";
  const today = new Date().toISOString().slice(0, 10);
  const etaLabel = shortDate(initialPauseUntil ?? null);
  const etaDirty = (pauseUntil || "") !== (initialPauseUntil ?? "");

  return (
    <div className="flex flex-col gap-3">
      {/* Participation */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="text-[15px] font-semibold text-ink">
          Participation
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {paused
            ? etaLabel
              ? `You're paused — your pod can see you're aiming to be back around ${etaLabel}. Resume whenever you're ready.`
              : "You're paused. You don't count toward the pod's perfect-week streak right now — resume when you're back."
            : "Going to be away — travel, illness, a busy week? Pause so a missed week doesn't break the pod's streak."}
        </p>

        {!paused && (
          <div className="mt-3 flex flex-col gap-2.5">
            <label className="text-[13px] font-medium text-muted">
              Back by{" "}
              <span className="text-muted/70">
                (optional — your pod will see this)
              </span>
            </label>
            <input
              type="date"
              value={pauseUntil}
              min={today}
              onChange={(e) => setPauseUntil(e.target.value)}
              className="rounded-xl border border-line bg-paper-2/60 px-4 py-3 text-[15px] text-ink outline-none focus:border-terra"
            />
            <button
              onClick={pause}
              disabled={busy}
              className="rounded-xl border border-line bg-paper-2/60 py-3 text-[15px] font-semibold text-ink-soft transition active:scale-[0.99] disabled:opacity-60"
            >
              Pause my participation
            </button>
          </div>
        )}

        {paused && (
          <div className="mt-3 flex flex-col gap-2">
            <label className="text-[13px] font-medium text-muted">
              Expected back
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={pauseUntil}
                min={today}
                onChange={(e) => setPauseUntil(e.target.value)}
                className="flex-1 rounded-xl border border-line bg-paper-2/60 px-4 py-3 text-[15px] text-ink outline-none focus:border-terra"
              />
              <button
                onClick={updateEta}
                disabled={busy || !etaDirty}
                className="shrink-0 rounded-xl border border-line bg-paper-2/60 px-4 text-[14px] font-semibold text-ink-soft transition active:scale-[0.99] disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {paused && !stakesActive && (
          <button
            onClick={() => resume(null)}
            disabled={busy}
            className="mt-2.5 w-full rounded-xl bg-terra py-3 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            Resume participation
          </button>
        )}

        {paused && stakesActive && (
          <div className="mt-2.5">
            <p className="text-[13px] leading-relaxed text-muted">
              Stakes are running. Choose when they pick you back up — whole weeks
              only, so you're not staked on a week you can't finish.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={() => resume(nextWeekStart)}
                disabled={busy}
                className="w-full rounded-xl bg-terra py-3 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
              >
                Resume — staked from Monday
              </button>
              <button
                onClick={() => resume(currentWeekStart)}
                disabled={busy}
                className="w-full rounded-xl border border-line bg-paper-2/60 py-3 text-[15px] font-semibold text-ink-soft transition active:scale-[0.99] disabled:opacity-60"
              >
                Join this week now ({daysLeftThisWeek}{" "}
                {daysLeftThisWeek === 1 ? "day" : "days"} left)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Display name */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-ink">
              Display name
            </div>
            <div className="mt-0.5 truncate text-[16px] text-ink-soft">
              {displayName}
            </div>
            <p className="mt-0.5 text-[13px] text-muted">
              How your pods see you.
            </p>
          </div>
          <Link
            href={`/app/welcome?from=settings&pod=${podId}`}
            className="shrink-0 text-[13px] font-semibold text-terra"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Leave pod */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="text-[15px] font-semibold text-ink">Leave this pod</div>
        <p className="mt-0.5 text-[13px] text-muted">
          Step out of {podName}. You can rejoin anytime with the code.
        </p>
        <button
          onClick={leave}
          disabled={busy}
          className="mt-3 text-[15px] font-semibold text-terra"
        >
          Leave pod
        </button>
      </div>
    </div>
  );
}
