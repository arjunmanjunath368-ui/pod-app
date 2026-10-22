"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MOVE_SLOTS, type MoveSlot } from "@/lib/moveSlots";

// Set move times right from Home, for members who skipped it (or joined
// before it existed). Saves and disappears; Settings has the full editor.
export default function MoveTimesQuick({ userId }: { userId: string }) {
  const router = useRouter();
  const [slots, setSlots] = useState<MoveSlot[]>([]);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  function toggle(k: MoveSlot) {
    setState("idle");
    setSlots((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.concat([k])));
  }

  async function save() {
    if (!slots.length) return;
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
        .update({ move_slots: slots, timezone: tz })
        .eq("id", userId);
      if (error) throw error;
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-[18px]">🔔</span>
        <h3 className="text-[16px] font-semibold text-ink">When should Pod nudge you?</h3>
      </div>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
        Pick when you usually have time to move. If you haven't by then, you get
        one nudge with who in your pod already showed up.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {MOVE_SLOTS.map((m) => {
          const on = slots.includes(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              aria-pressed={on}
              className={`rounded-xl border-2 px-2 py-2 text-center transition active:scale-[0.97] ${
                on ? "border-terra bg-terra/[0.10]" : "border-line bg-paper"
              }`}
            >
              <div className="text-[13px] font-semibold leading-tight text-ink">
                {m.label.replace(" morning", "")}
              </div>
              <div className="mt-0.5 text-[11px] text-muted">{m.hours}</div>
            </button>
          );
        })}
      </div>
      {slots.length > 0 && (
        <button
          onClick={save}
          disabled={state === "saving"}
          className="mt-3 w-full rounded-full bg-ink py-2.5 text-[14px] font-semibold text-paper transition disabled:opacity-50 active:scale-[0.98]"
        >
          {state === "saving" ? "Saving…" : "Save my times"}
        </button>
      )}
      {state === "error" && (
        <p className="mt-2 text-center text-[13px] text-terra">Couldn't save that. Try again.</p>
      )}
    </div>
  );
}
