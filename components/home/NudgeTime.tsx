"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NUDGE_HOURS, formatHour, hourToken, nextNudge } from "@/lib/moveSlots";

// The member's nudge times, shared by every place on Home that mentions them
// (the rings card and the Your turn card), so editing one updates both.

type Ctx = {
  hours: number[];
  text: string | null; // "at 6 pm" / "tomorrow at 7 am"
  open: () => void;
};

const NudgeCtx = createContext<Ctx | null>(null);

function tokens(hours: number[]) {
  return hours.map((h) => `h${h}`);
}

export function NudgeTimeProvider({
  initialHours,
  tz,
  nowIso,
  userId,
  demo = false,
  children,
}: {
  initialHours: number[];
  tz: string;
  nowIso: string;
  userId?: string;
  demo?: boolean;
  children: React.ReactNode;
}) {
  const key = initialHours.join(",");
  const [hours, setHours] = useState<number[]>(initialHours);
  const [sheet, setSheet] = useState(false);
  // A save elsewhere (e.g. the Home quick picker) re-renders with new hours.
  useEffect(() => setHours(initialHours), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const text = useMemo(() => {
    try {
      return nextNudge(tokens(hours), tz, new Date(nowIso))?.text ?? null;
    } catch {
      return null;
    }
  }, [hours, tz, nowIso]);

  return (
    <NudgeCtx.Provider value={{ hours, text, open: () => setSheet(true) }}>
      {children}
      {sheet && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Nudge times">
          <button aria-label="Close" onClick={() => setSheet(false)} className="absolute inset-0 bg-ink/40" />
          <div className="sheet-enter relative max-h-[86vh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] bg-paper px-6 pb-10 pt-3 shadow-pod-lg">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
            <NudgeHoursEditor
              initialHours={hours}
              userId={userId}
              demo={demo}
              onSaved={(h) => {
                setHours(h);
                setSheet(false);
              }}
              onCancel={() => setSheet(false)}
            />
          </div>
        </div>
      )}
    </NudgeCtx.Provider>
  );
}

// Pick exact nudge times. Used in the Home sheet and in Settings.
export function NudgeHoursEditor({
  initialHours,
  userId,
  demo = false,
  onSaved,
  onCancel,
  heading = true,
}: {
  initialHours: number[];
  userId?: string;
  demo?: boolean;
  onSaved?: (hours: number[]) => void;
  onCancel?: () => void;
  heading?: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<number[]>(initialHours);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  function toggle(h: number) {
    setState("idle");
    setPicked((p) => (p.includes(h) ? p.filter((x) => x !== h) : p.concat([h]).sort((a, b) => a - b)));
  }

  async function save(next: number[]) {
    if (demo || !userId) {
      onSaved?.(next);
      return;
    }
    setState("saving");
    try {
      let tz: string | null = null;
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      } catch {
        tz = null;
      }
      const { error } = await createClient()
        .from("profiles")
        .update({ move_slots: next.length ? next.map(hourToken) : null, timezone: tz })
        .eq("id", userId);
      if (error) throw error;
      setState("idle");
      onSaved?.(next);
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div>
      {heading && (
        <>
          <h2 className="font-serif text-[24px] font-semibold leading-tight text-ink">When should Pod nudge you?</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
            On a day you haven&apos;t moved yet, Pod sends one nudge at the first of these times, with who in your
            pod already showed up.
          </p>
        </>
      )}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {NUDGE_HOURS.map((h) => {
          const on = picked.includes(h);
          return (
            <button
              key={h}
              onClick={() => toggle(h)}
              aria-pressed={on}
              className={`rounded-xl border-2 py-2.5 text-[14px] font-semibold tabular-nums transition active:scale-[0.97] ${
                on ? "border-terra bg-terra/[0.10] text-ink" : "border-line bg-card text-ink-soft"
              }`}
            >
              {formatHour(h)}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => save(picked)}
          disabled={state === "saving" || picked.length === 0}
          className="flex-1 rounded-full bg-ink py-3 text-[15px] font-semibold text-paper transition disabled:opacity-40 active:scale-[0.98]"
        >
          {state === "saving"
            ? "Saving…"
            : picked.length
              ? `Nudge me at ${picked.map(formatHour).join(", ")}`
              : "Pick a time"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-full border border-line bg-card px-4 py-3 text-[15px] font-semibold text-ink-soft active:scale-[0.98]"
          >
            Cancel
          </button>
        )}
      </div>
      {initialHours.length > 0 && (
        <button
          onClick={() => save([])}
          className="mt-3 w-full text-center text-[14px] font-semibold text-muted underline-offset-2 hover:underline"
        >
          Turn off nudges
        </button>
      )}
      {state === "error" && <p className="mt-2 text-center text-[13px] text-terra">Couldn&apos;t save that. Try again.</p>}
    </div>
  );
}

// On the rings card (dark): "Nudge at 6 pm ✎".
export function NudgeChip() {
  const ctx = useContext(NudgeCtx);
  if (!ctx) return null;
  return (
    <button
      onClick={ctx.open}
      className="flex items-center gap-1.5 rounded-full bg-paper/[0.08] px-3 py-1.5 text-[13px] font-semibold text-paper transition active:scale-95"
    >
      <span aria-hidden>🔔</span>
      {ctx.text ? `Nudge ${ctx.text}` : "Set a nudge time"}
      <span aria-hidden className="text-sage-soft">✎</span>
    </button>
  );
}

// On the Your turn card (light).
export function NudgeLine() {
  const ctx = useContext(NudgeCtx);
  if (!ctx || !ctx.hours.length || !ctx.text) return null;
  return (
    <button
      onClick={ctx.open}
      className="mt-3 flex w-full items-center gap-2.5 rounded-2xl bg-paper-2/70 px-3.5 py-2.5 text-left text-[15px] text-ink-soft transition active:scale-[0.99]"
    >
      <span aria-hidden className="text-[16px]">🔔</span>
      <span className="min-w-0 flex-1">
        Not moved by <b className="font-semibold text-ink">{ctx.text.replace(/^at /, "")}</b>? Pod nudges you once.
      </span>
      <span className="shrink-0 text-[13px] font-semibold text-terra">Change</span>
    </button>
  );
}

export function useNudgeHours(): number[] | null {
  return useContext(NudgeCtx)?.hours ?? null;
}
