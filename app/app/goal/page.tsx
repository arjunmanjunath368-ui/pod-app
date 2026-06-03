"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITIES, activityMeta, type ActivityKey } from "@/lib/activities";

function GoalForm() {
  const router = useRouter();
  const params = useSearchParams();
  const podId = params.get("pod") ?? "";

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [activity, setActivity] = useState<ActivityKey>("strength");
  const [target, setTarget] = useState(3);
  const [label, setLabel] = useState("Strength");
  const [labelTouched, setLabelTouched] = useState(false);
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);

      if (podId) {
        const { data } = await supabase
          .from("pod_members")
          .select(
            "goal_activity, goal_label, goal_target_per_week, goal_detail"
          )
          .eq("pod_id", podId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (data && data.goal_target_per_week) {
          setActivity((data.goal_activity as ActivityKey) ?? "strength");
          setTarget(data.goal_target_per_week);
          setLabel(data.goal_label ?? activityMeta(data.goal_activity).label);
          setLabelTouched(true);
          setDetail(data.goal_detail ?? "");
        }
      }
      setLoading(false);
    })();
  }, [podId, router]);

  function pickActivity(k: ActivityKey) {
    setActivity(k);
    if (!labelTouched) setLabel(activityMeta(k).label);
  }

  async function save() {
    if (!podId) {
      setError("Missing pod. Go back to Home and try again.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase
      .from("pod_members")
      .update({
        goal_activity: activity,
        goal_label: label.trim() || activityMeta(activity).label,
        goal_target_per_week: target,
        goal_detail: detail.trim() || null,
      })
      .eq("pod_id", podId)
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/app?pod=${podId}`);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[14px] text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-7 py-9">
      <Link
        href={`/app?pod=${podId}`}
        className="text-[13px] font-semibold text-muted"
      >
        ← Back
      </Link>

      <h1 className="mt-6 font-serif text-[26px] font-semibold text-ink">
        Your weekly goal
      </h1>
      <p className="mt-2 text-[13.5px] text-muted">
        This is yours alone — pick what you'll commit to. The pod is scored on
        everyone showing up to their own goal, not on matching each other.
      </p>

      <div className="mt-6 text-[12.5px] font-semibold uppercase tracking-wide text-muted">
        Activity
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {ACTIVITIES.map((a) => (
          <button
            key={a.key}
            onClick={() => pickActivity(a.key)}
            className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition ${
              activity === a.key
                ? "border-terra bg-terra/[0.06]"
                : "border-line bg-card"
            }`}
          >
            <span className="text-[22px]">{a.emoji}</span>
            <span className="text-[12px] font-semibold text-ink">
              {a.label}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 text-[12.5px] font-semibold uppercase tracking-wide text-muted">
        Times per week
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-card px-5 py-3">
        <button
          onClick={() => setTarget((t) => Math.max(1, t - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-[22px] text-ink active:scale-95"
        >
          −
        </button>
        <div className="text-center">
          <div className="font-serif text-[30px] font-semibold text-ink">
            {target}
          </div>
          <div className="text-[11px] text-muted">times / week</div>
        </div>
        <button
          onClick={() => setTarget((t) => Math.min(7, t + 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-[22px] text-ink active:scale-95"
        >
          +
        </button>
      </div>

      <div className="mt-6 text-[12.5px] font-semibold uppercase tracking-wide text-muted">
        Label (optional)
      </div>
      <input
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          setLabelTouched(true);
        }}
        placeholder="Weight training"
        maxLength={30}
        className="mt-3 w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-[15px] text-ink outline-none focus:border-terra"
      />

      <div className="mt-5 text-[12.5px] font-semibold uppercase tracking-wide text-muted">
        Detail (optional)
      </div>
      <input
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="45 min+ · or · 8,000 steps"
        maxLength={30}
        className="mt-3 w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-[15px] text-ink outline-none focus:border-terra"
      />

      {error && <p className="mt-4 text-[12.5px] text-terra">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="mt-7 w-full rounded-2xl bg-ink py-4 text-[15.5px] font-semibold text-paper transition active:scale-[0.98] disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save goal"}
      </button>
    </div>
  );
}

export default function GoalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-[14px] text-muted">
          Loading…
        </div>
      }
    >
      <GoalForm />
    </Suspense>
  );
}
