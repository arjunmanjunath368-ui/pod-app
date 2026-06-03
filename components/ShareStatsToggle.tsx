"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ShareStatsToggle({
  userId,
  initial,
}: {
  userId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    setErr("");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ share_stats: next })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setOn(!next); // revert the switch if it didn't save
      setErr("Couldn't save — make sure the latest setup has been applied.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        onClick={toggle}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-between border-t border-line pt-3"
      >
        <span className="text-[14px] text-ink-soft">
          Show my active days to my pods
        </span>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            on ? "bg-terra" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              on ? "left-[22px]" : "left-0.5"
            }`}
          />
        </span>
      </button>
      {err && <p className="mt-2 text-[12px] text-terra">{err}</p>}
    </>
  );
}
