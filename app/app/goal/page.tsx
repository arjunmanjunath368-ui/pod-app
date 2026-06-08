"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITIES, activityMeta, type ActivityKey } from "@/lib/activities";

type Mode = "combined" | "split";

function GoalForm() {
  const router = useRouter();
  const params = useSearchParams();
  const podId = params.get("pod") ?? "";

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [mode, setMode] = useState<Mode>("combined");
  const [selected, setSelected] = useState<ActivityKey[]>(["strength"]);
  const [combinedTarget, setCombinedTarget] = useState(3);
  const [splitTargets, setSplitTargets] = useState<
    Partial<Record<ActivityKey, number>>
  >({ strength: 2 });
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
            "goal_activity, goal_label, goal_target_per_week, goal_detail, goal_mode, goal_activities, goal_splits"
          )
          .eq("pod_id", podId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (data && (data.goal_target_per_week || data.goal_splits)) {
          const splits: { activity?: string; target?: number }[] = Array.isArray(
            data.goal_splits
          )
            ? (data.goal_splits as any[])
            : [];
          if (data.goal_mode === "split" && splits.length > 0) {
            setMode("split");
            const sel = splits
              .map((s) => s.activity as ActivityKey)
              .filter(Boolean);
            setSelected(sel.length ? sel : ["strength" as ActivityKey]);
            const st: Partial<Record<ActivityKey, number>> = {};
            splits.forEach((s) => {
              if (s.activity) st[s.activity as ActivityKey] = Number(s.target) || 1;
            });
            setSplitTargets(st);
          } else {
            setMode("combined");
            const sel =
              Array.isArray(data.goal_activities) && data.goal_activities.length
                ? (data.goal_activities as ActivityKey[])
                : data.goal_activity
                  ? [data.goal_activity as ActivityKey]
                  : ["strength" as ActivityKey];
            setSelected(sel);
            setCombinedTarget(data.goal_target_per_week || 3);
          }
          setLabel(
            data.goal_label ?? activityMeta(data.goal_activity).label
          );
          setLabelTouched(true);
          setDetail(data.goal_detail ?? "");
        }
      }
      setLoading(false);
    })();
  }, [podId, router]);

  function toggleActivity(k: ActivityKey) {
    setSelected((prev) => {
      const has = prev.includes(k);
      const next = has ? prev.filter((x) => x !== k) : [...prev, k];
      // Never allow empty.
      const safe = next.length ? next : prev;
      if (!has) {
        setSplitTargets((t) => (t[k] ? t : { ...t, [k]: 2 }));
        if (!labelTouched && safe.length === 1) setLabel(activityMeta(k).label);
      }
      return safe;
    });
  }

  function setSplit(k: ActivityKey, n: number) {
    setSplitTargets((t) => ({ ...t, [k]: Math.max(1, Math.min(7, n)) }));
  }

  async function save() {
    if (!podId) {
      setError("Missing pod. Go back to Home and try again.");
      return;
    }
    if (selected.length === 0) {
      setError("Pick at least one activity.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();

    const primary = selected[0];
    const labelOut = label.trim() || activityMeta(primary).label;

    let payload: Record<string, any>;
    if (mode === "split") {
      const splits = selected.map((a) => ({
        activity: a,
        target: splitTargets[a] ?? 1,
      }));
      payload = {
        goal_mode: "split",
        goal_activity: primary,
        goal_activities: selected,
        goal_splits: splits,
        goal_target_per_week: splits.reduce((s, x) => s + x.target, 0),
        goal_label: labelOut,
        goal_detail: detail.trim() || null,
      };
    } else {
      payload = {
        goal_mode: "combined",
        goal_activity: primary,
        goal_activities: selected,
        goal_splits: null,
        goal_target_per_week: combinedTarget,
        goal_label: labelOut,
        goal_detail: detail.trim() || null,
      };
    }

    const { error } = await supabase
      .from("pod_members")
      .update(payload)
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
      <div className="flex flex-1 items-center justify-center text-[15px] text-muted">
        Loading…
      </div>
    );
  }

  const splitSum = selected.reduce((s, a) => s + (splitTargets[a] ?? 1), 0);

  return (
    <div className="flex flex-1 flex-col px-7 py-9">
      <Link
        href={`/app?pod=${podId}`}
        className="text-[15px] font-semibold text-muted"
      >
        ← Back
      </Link>

      <h1 className="mt-6 font-serif text-[26px] font-semibold text-ink">
        Your weekly goal
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        This is yours alone — pick what you'll commit to. The pod is scored on
        everyone showing up to their own goal, not on matching each other.
      </p>

      {/* Mode toggle */}
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-paper-2 p-1">
        <button
          onClick={() => setMode("combined")}
          className={`rounded-xl py-2.5 text-[14px] font-semibold transition ${
            mode === "combined" ? "bg-card text-ink shadow-sm" : "text-muted"
          }`}
        >
          One combined goal
        </button>
        <button
          onClick={() => setMode("split")}
          className={`rounded-xl py-2.5 text-[14px] font-semibold transition ${
            mode === "split" ? "bg-card text-ink shadow-sm" : "text-muted"
          }`}
        >
          A goal per activity
        </button>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        {mode === "combined"
          ? "One weekly number — any of your chosen activities counts toward it."
          : "Set a separate weekly target for each activity. You hit your goal only when every one is met."}
      </p>

      {/* Activity picker (multi-select) */}
      <div className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted">
        {mode === "combined" ? "Activities" : "Activities & targets"}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {ACTIVITIES.map((a) => {
          const on = selected.includes(a.key);
          return (
            <button
              key={a.key}
              onClick={() => toggleActivity(a.key)}
              className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition ${
                on ? "border-terra bg-terra/[0.06]" : "border-line bg-card"
              }`}
            >
              <span className="text-[22px]">{a.emoji}</span>
              <span className="text-[13px] font-semibold text-ink">
                {a.label}
              </span>
            </button>
          );
        })}
      </div>

      {mode === "combined" ? (
        <>
          <div className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted">
            Times per week
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-card px-5 py-3">
            <button
              onClick={() => setCombinedTarget((t) => Math.max(1, t - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-[22px] text-ink active:scale-95"
            >
              −
            </button>
            <div className="text-center">
              <div className="font-serif text-[30px] font-semibold text-ink">
                {combinedTarget}
              </div>
              <div className="text-[12px] text-muted">times / week</div>
            </div>
            <button
              onClick={() => setCombinedTarget((t) => Math.min(7, t + 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-[22px] text-ink active:scale-95"
            >
              +
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-2.5">
            {selected.map((a) => {
              const meta = activityMeta(a);
              const n = splitTargets[a] ?? 1;
              return (
                <div
                  key={a}
                  className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[22px]">{meta.emoji}</span>
                    <span className="text-[15px] font-semibold text-ink">
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSplit(a, n - 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-2 text-[20px] text-ink active:scale-95"
                    >
                      −
                    </button>
                    <div className="w-8 text-center font-serif text-[22px] font-semibold text-ink">
                      {n}
                    </div>
                    <button
                      onClick={() => setSplit(a, n + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-2 text-[20px] text-ink active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 text-[13px] text-muted">
            That's <b className="text-ink">{splitSum}</b> session
            {splitSum === 1 ? "" : "s"} a week across {selected.length} activit
            {selected.length === 1 ? "y" : "ies"}.
          </p>
        </>
      )}

      <div className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted">
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
        className="mt-3 w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-[16px] text-ink outline-none focus:border-terra"
      />

      <div className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-muted">
        Detail (optional)
      </div>
      <input
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="45 min+ · or · 8,000 steps"
        maxLength={30}
        className="mt-3 w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-[16px] text-ink outline-none focus:border-terra"
      />

      {error && <p className="mt-4 text-[13px] text-terra">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="mt-7 w-full rounded-2xl bg-ink py-4 text-[16px] font-semibold text-paper transition active:scale-[0.98] disabled:opacity-60"
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
        <div className="flex flex-1 items-center justify-center text-[15px] text-muted">
          Loading…
        </div>
      }
    >
      <GoalForm />
    </Suspense>
  );
}
