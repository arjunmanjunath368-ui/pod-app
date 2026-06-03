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
}: {
  podId: string;
  userId: string;
  initialStatus: string;
  podName: string;
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
        <div className="text-[14px] font-semibold text-ink">
          Participation
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          {paused
            ? "You're paused. You don't count toward the pod's perfect-week streak right now — resume when you're back."
            : "Going to be away — travel, illness, a busy week? Pause so a missed week doesn't break the pod's streak."}
        </p>
        <button
          onClick={() => setMembership(paused ? "active" : "paused")}
          disabled={busy}
          className={`mt-3 w-full rounded-xl py-3 text-[14px] font-semibold transition active:scale-[0.99] disabled:opacity-60 ${
            paused
              ? "bg-terra text-white"
              : "border border-line bg-paper-2/60 text-ink-soft"
          }`}
        >
          {paused ? "Resume participation" : "Pause my participation"}
        </button>
      </div>

      {/* Display name */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold text-ink">
              Display name
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted">
              How your pods see you.
            </p>
          </div>
          <Link
            href="/app/welcome"
            className="text-[12.5px] font-semibold text-terra"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Leave pod */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="text-[14px] font-semibold text-ink">Leave this pod</div>
        <p className="mt-0.5 text-[12.5px] text-muted">
          Step out of {podName}. You can rejoin anytime with the code.
        </p>
        <button
          onClick={leave}
          disabled={busy}
          className="mt-3 text-[13px] font-semibold text-terra"
        >
          Leave pod
        </button>
      </div>
    </div>
  );
}
