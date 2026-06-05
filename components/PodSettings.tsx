"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function PodSettings({
  podId,
  userId,
  initialStatus,
  podName,
  displayName,
  stakesActive,
  currentWeekStart,
  nextWeekStart,
}: {
  podId: string;
  userId: string;
  initialStatus: string;
  podName: string;
  displayName: string;
  stakesActive: boolean;
  currentWeekStart: string;
  nextWeekStart: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
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

  // Resume, choosing when stakes pick you back up: this week ("join now") or the
  // next full week. staked_from gates the live week in the stakes engine.
  async function resume(stakedFrom: string | null) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("pod_members")
      .update({ status: "active", staked_from: stakedFrom })
      .eq("pod_id", podId)
      .eq("user_id", userId);
    setBusy(false);
    if (error) return;
    setStatus("active");
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

  return (
    <div className="flex flex-col gap-3">
      {/* Participation */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="text-[15px] font-semibold text-ink">
          Participation
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {paused
            ? "You're paused. You don't count toward the pod's perfect-week streak right now — resume when you're back."
            : "Going to be away — travel, illness, a busy week? Pause so a missed week doesn't break the pod's streak."}
        </p>

        {!paused && (
          <button
            onClick={() => setMembership("paused")}
            disabled={busy}
            className="mt-3 w-full rounded-xl border border-line bg-paper-2/60 py-3 text-[15px] font-semibold text-ink-soft transition active:scale-[0.99] disabled:opacity-60"
          >
            Pause my participation
          </button>
        )}

        {paused && !stakesActive && (
          <button
            onClick={() => resume(null)}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-terra py-3 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            Resume participation
          </button>
        )}

        {paused && stakesActive && (
          <div className="mt-3">
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
