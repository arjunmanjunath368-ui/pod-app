"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MOVE_SLOTS, type MoveSlot } from "@/lib/moveSlots";

// When the member usually has time to move. Pod nudges them once at the start
// of a window on days they haven't been active yet.
export default function MoveTimesPanel({
  userId,
  initial,
  available,
}: {
  userId: string;
  initial: MoveSlot[];
  available: boolean; // false until the database update has been run
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<MoveSlot[]>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty =
    slots.length !== initial.length || slots.some((s) => !initial.includes(s));

  function toggle(k: MoveSlot) {
    setState("idle");
    setSlots((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.concat([k])));
  }

  async function save() {
    setState("saving");
    try {
      let tz: string | null = null;
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      } catch {
        tz = null;
      }
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ move_slots: slots.length ? slots : null, timezone: tz })
        .eq("id", userId);
      if (error) throw error;
      setState("saved");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div id="move-times" className="scroll-mt-6 rounded-2xl border border-line bg-card p-4">
      <div className="text-[15px] font-semibold text-ink">🕒 When you usually move</div>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
        If you haven't moved by the start of one of these, Pod sends one nudge
        and tells you who in your pod already showed up. Never more than one a day.
      </p>
      {!available ? (
        <p className="mt-3 text-[13px] text-muted">Available after the next update.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {MOVE_SLOTS.map((m) => {
              const on = slots.includes(m.key);
              return (
                <button
                  key={m.key}
                  onClick={() => toggle(m.key)}
                  aria-pressed={on}
                  className={`relative rounded-xl border-2 px-3 py-2.5 text-left transition active:scale-[0.98] ${
                    on ? "border-terra bg-terra/[0.10]" : "border-line bg-paper"
                  }`}
                >
                  {on && (
                    <span className="absolute right-2.5 top-2.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-terra text-[11px] font-bold text-paper">
                      ✓
                    </span>
                  )}
                  <div className="text-[14px] font-semibold text-ink">{m.label}</div>
                  <div className="text-[12px] text-muted">{m.hours}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={save}
              disabled={!dirty || state === "saving"}
              className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-paper transition disabled:opacity-40 active:scale-95"
            >
              {state === "saving" ? "Saving…" : "Save times"}
            </button>
            {state === "saved" && !dirty && <span className="text-[13px] text-sage">Saved</span>}
            {state === "error" && (
              <span className="text-[13px] text-terra">Couldn't save. Try again.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
