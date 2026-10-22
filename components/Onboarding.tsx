"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITIES, type ActivityKey } from "@/lib/activities";
import { MOVE_SLOTS, type MoveSlot } from "@/lib/moveSlots";

// Onboarding that *is* the setup, not a lecture before it.
//
// One visual welcome, then two taps that set a real weekly goal — so a new
// member lands in the app already activated (Home otherwise nags: "until you
// set a goal, you're not in the count"). Stakes and Pause are taught
// contextually, where they matter: the stakes card on Home, and the pause
// prompt that appears when someone goes quiet.
//
// A weekly goal is required, so Skip only exists when every pod already has
// one (replaying the tour from Settings). Anyone still missing a goal has to
// pick one here. This is the only place a new member is asked for their goal:
// joining or starting a pod comes straight here, not to the goal screen.
//
// The last step asks when they usually have time to move, so Pod can nudge
// them at the right moment instead of relying on a pod-mate to remember.
export default function Onboarding({
  userId,
  pods,
  podName,
  mates = [],
  needsGoal = true,
  hasMoveTimes = false,
  open,
  canSkip = true,
}: {
  userId: string;
  pods: { id: string; name: string }[];
  podName?: string;
  mates?: { name: string; initials: string; color: string }[];
  needsGoal?: boolean;
  hasMoveTimes?: boolean;
  open: boolean;
  canSkip?: boolean;
}) {
  const router = useRouter();
  const [show, setShow] = useState(open);
  const [step, setStep] = useState(0);
  const [days, setDays] = useState<number | null>(null);
  const [acts, setActs] = useState<ActivityKey[]>([]);
  const [slots, setSlots] = useState<MoveSlot[]>([]);
  const [saving, setSaving] = useState(false);

  if (!show) return null;

  // Steps actually shown: welcome, the goal (if needed), move times (if not set).
  const steps: number[] = [0];
  if (needsGoal) steps.push(1, 2);
  if (!hasMoveTimes) steps.push(3);
  const pos = steps.indexOf(step);
  const nextStep = () => setStep(steps[Math.min(pos + 1, steps.length - 1)]);
  const isLast = pos === steps.length - 1;

  // The welcome shows their real pod: their pod-mates, or space for them.
  const people = [
    { name: "You", initials: "", color: "#c8553d", w: "100%" },
    ...mates.slice(0, 2).map((m, i) => ({ ...m, w: i === 0 ? "72%" : "100%" })),
  ];
  while (people.length < 3)
    people.push({ name: "", initials: "", color: "", w: people.length === 1 ? "72%" : "100%" });

  async function skip() {
    setShow(false);
    try {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("id", userId);
      router.refresh();
    } catch {
      /* non-blocking */
    }
  }

  async function finish() {
    if (needsGoal && (!days || acts.length === 0)) return;
    setSaving(true);
    const supabase = createClient();
    try {
      // Apply as their goal in every pod that doesn't have one yet.
      for (const p of needsGoal ? pods : []) {
        await supabase
          .from("pod_members")
          .update({
            goal_mode: "combined",
            goal_activity: acts[0],
            goal_activities: acts,
            goal_splits: null,
            goal_target_per_week: days,
            goal_label: null,
            goal_detail: null,
          })
          .eq("pod_id", p.id)
          .eq("user_id", userId)
          .is("goal_target_per_week", null);
      }
      await supabase
        .from("profiles")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("id", userId);
    } catch {
      /* if this fails they just get the normal "set your goal" prompt */
    }
    // Move times and time zone: their own write, so a missing column (before
    // the migration) can't undo the goal above.
    if (slots.length) {
      try {
        let tz: string | null = null;
        try {
          tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
        } catch {
          tz = null;
        }
        await supabase
          .from("profiles")
          .update({ move_slots: slots, timezone: tz })
          .eq("id", userId);
      } catch {
        /* they can set these in Settings */
      }
    }
    setSaving(false);
    setShow(false);
    router.refresh();
  }

  function toggleSlot(k: MoveSlot) {
    setSlots((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.concat([k])));
  }

  function toggleAct(k: ActivityKey) {
    setActs((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : prev.concat([k])
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-paper">
      <style>{`
        @keyframes podFill { from { width: 0 } to { width: var(--w) } }
        @keyframes podTick { 0%, 30% { opacity: 0; transform: scale(.5) } 55%, 100% { opacity: 1; transform: scale(1) } }
        @keyframes podRise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div className="flex justify-end px-5 pt-5">
        {canSkip ? (
          <button
            onClick={skip}
            className="text-[14px] font-semibold text-muted active:scale-95"
          >
            Skip
          </button>
        ) : (
          <span aria-hidden="true" className="invisible text-[14px] font-semibold">
            Skip
          </span>
        )}
      </div>

      {/* 0 · Welcome — the only screen that just shows. */}
      {step === 0 && (
        <>
          <div className="flex flex-1 flex-col items-center justify-center px-7">
            {/* A living miniature of their real pod's week filling in. */}
            <div className="w-full max-w-[300px] rounded-3xl bg-ink p-5 text-paper shadow-pod-lg">
              <div className="truncate text-[15px] font-semibold text-paper">
                {podName ?? "Your pod"}
              </div>
              <div className="text-[12px] text-sage-soft">This week</div>
              {people.map((m, i) => (
                <div
                  key={i}
                  className="mt-3.5 flex items-center gap-3"
                  style={{ animation: `podRise .5s ease-out ${i * 0.12}s both` }}
                >
                  {m.name ? (
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-paper"
                      style={{ backgroundColor: m.color || "#c8553d" }}
                    >
                      {m.initials}
                    </div>
                  ) : (
                    <div className="h-7 w-7 shrink-0 rounded-full border border-dashed border-paper/40" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[13px] font-semibold ${m.name ? "" : "text-sage-soft/70"}`}>
                      {m.name || "Invite someone"}
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper/20">
                      {m.name && (
                        <div
                          className="h-full rounded-full bg-sage"
                          style={
                            {
                              "--w": m.w,
                              animation: `podFill 1s ease-out ${0.3 + i * 0.3}s both`,
                            } as any
                          }
                        />
                      )}
                    </div>
                  </div>
                  <span
                    className="text-[15px]"
                    style={{ animation: `podTick 1.2s ease-out ${0.6 + i * 0.3}s both`, visibility: m.name ? "visible" : "hidden" }}
                  >
                    ✓
                  </span>
                </div>
              ))}
            </div>

            <h2 className="mt-8 text-center font-serif text-[27px] font-semibold leading-tight text-ink">
              A few people who notice
              <br />
              whether you showed up
            </h2>
            <p className="mt-2.5 max-w-xs text-center text-[15px] leading-relaxed text-ink-soft">
              Everyone sets their own goal. Nobody's ranked on who lifts more,
              only on turning up.
            </p>
          </div>

          <div className="px-7 pb-10">
            <button
              onClick={isLast ? finish : nextStep}
              disabled={saving}
              className="w-full rounded-full bg-terra py-3.5 text-[16px] font-semibold text-paper active:scale-[0.98]"
            >
              {needsGoal ? "Set my goal" : isLast ? "Got it" : "Next"}
            </button>
          </div>
        </>
      )}

      {/* 1 · Days — teaches "your goal is yours" by making them choose it. */}
      {step === 1 && (
        <>
          <div className="flex flex-1 flex-col justify-center px-7">
            <h2 className="font-serif text-[26px] font-semibold leading-tight text-ink">
              How many days a week
              <br />
              will you show up?
            </h2>
            <p className="mt-2 text-[15px] text-muted">
              Pick what you'd hit on a bad week, not a good one.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {[2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  onClick={() => setDays(n)}
                  className={`rounded-2xl border p-4 text-center transition active:scale-[0.98] ${
                    days === n
                      ? "border-terra bg-terra/[0.08]"
                      : "border-line bg-card"
                  }`}
                >
                  <div className="font-serif text-[26px] font-semibold leading-none text-ink">
                    {n}
                  </div>
                  <div className="mt-1 text-[12px] text-muted">
                    {n === 7 ? "daily" : "days"}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="px-7 pb-10">
            <button
              disabled={!days}
              onClick={nextStep}
              className="w-full rounded-full bg-terra py-3.5 text-[16px] font-semibold text-paper transition disabled:opacity-40 active:scale-[0.98]"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* 2 · Activities — then save a real goal and drop them into the app. */}
      {step === 2 && (
        <>
          <div className="flex flex-1 flex-col justify-center px-7">
            <h2 className="font-serif text-[26px] font-semibold leading-tight text-ink">
              What will you mostly do?
            </h2>
            <p className="mt-2 text-[15px] text-muted">
              Any activity counts toward your {days} active days. This just
              tells your pod what to expect.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {ACTIVITIES.map((a) => {
                const on = acts.includes(a.key);
                return (
                  <button
                    key={a.key}
                    onClick={() => toggleAct(a.key)}
                    className={`rounded-full border px-4 py-2.5 text-[15px] font-semibold transition active:scale-95 ${
                      on
                        ? "border-terra bg-terra/[0.08] text-ink"
                        : "border-line bg-card text-ink-soft"
                    }`}
                  >
                    {a.emoji} {a.label}
                  </button>
                );
              })}
            </div>

            {acts.length > 0 && (
              <div
                className="mt-7 rounded-2xl border border-sage/40 bg-sage/[0.08] p-4"
                style={{ animation: "podRise .35s ease-out both" }}
              >
                <div className="text-[15px] font-semibold text-ink">
                  {days === 7 ? "Active every day" : `${days} active days a week`}
                </div>
                <div className="mt-0.5 text-[14px] text-ink-soft">
                  A day counts once, however much you do. Your pod sees every
                  one.
                </div>
              </div>
            )}
          </div>
          <div className="px-7 pb-10">
            <button
              disabled={acts.length === 0 || saving}
              onClick={isLast ? finish : nextStep}
              className="w-full rounded-full bg-terra py-3.5 text-[16px] font-semibold text-paper transition disabled:opacity-40 active:scale-[0.98]"
            >
              {isLast ? (saving ? "Setting up…" : "I'm in") : "Next"}
            </button>
          </div>
        </>
      )}

      {/* 3 · Move times: when Pod should nudge them. */}
      {step === 3 && (
        <>
          <div className="flex flex-1 flex-col justify-center px-7">
            <h2 className="font-serif text-[26px] font-semibold leading-tight text-ink">
              When do you usually
              <br />
              have time to move?
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              If you haven't moved by then, Pod gives you one nudge and tells you
              who in your pod already showed up. Pick any that fit.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {MOVE_SLOTS.map((m) => {
                const on = slots.includes(m.key);
                return (
                  <button
                    key={m.key}
                    onClick={() => toggleSlot(m.key)}
                    aria-pressed={on}
                    className={`relative rounded-2xl border-2 p-3.5 text-left transition active:scale-[0.98] ${
                      on ? "border-terra bg-terra/[0.10]" : "border-line bg-card"
                    }`}
                  >
                    {on && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-terra text-[12px] font-bold text-paper">
                        ✓
                      </span>
                    )}
                    <div className="text-[15px] font-semibold text-ink">{m.label}</div>
                    <div className="mt-0.5 text-[13px] text-muted">{m.hours}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-7 pb-10">
            <button
              disabled={saving}
              onClick={finish}
              className="w-full rounded-full bg-terra py-3.5 text-[16px] font-semibold text-paper transition disabled:opacity-40 active:scale-[0.98]"
            >
              {saving ? "Setting up…" : slots.length ? "I'm in" : "Skip for now"}
            </button>
          </div>
        </>
      )}

      <div className="flex justify-center gap-1.5 pb-7">
        {steps.map((n) => (
          <span
            key={n}
            className={`h-1.5 rounded-full transition-all ${
              n === step ? "w-5 bg-terra" : "w-1.5 bg-line"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
