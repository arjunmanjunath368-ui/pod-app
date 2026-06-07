"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NudgeButton({
  podId,
  fromUserId,
  toUserId,
  fromName,
}: {
  podId: string;
  fromUserId: string;
  toUserId: string;
  fromName?: string;
}) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function nudge() {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("nudges")
      .insert({ pod_id: podId, from_user: fromUserId, to_user: toUserId });
    setBusy(false);
    setSent(true);
    // Fire a push too (best-effort — the in-app nudge already landed).
    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toUserId,
        kind: "nudge",
        fromName,
        url: "/app",
      }),
    }).catch(() => {});
  }

  return (
    <button
      onClick={nudge}
      disabled={busy || sent}
      className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
        sent
          ? "bg-paper-2 text-muted"
          : "bg-terra/[0.10] text-terra"
      }`}
    >
      {sent ? "Nudged 👋" : "👋 Nudge"}
    </button>
  );
}
