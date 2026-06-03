"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NudgeBanner({
  nudges,
  userId,
}: {
  nudges: { id: string; fromName: string }[];
  userId: string;
}) {
  useEffect(() => {
    if (!nudges.length) return;
    (async () => {
      const supabase = createClient();
      await supabase
        .from("nudges")
        .update({ seen: true })
        .in(
          "id",
          nudges.map((n) => n.id)
        )
        .eq("to_user", userId);
    })();
  }, [nudges, userId]);

  if (!nudges.length) return null;

  const names = Array.from(new Set(nudges.map((n) => n.fromName)));
  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
      ? `${names[0]} and ${names[1]}`
      : `${names[0]} and ${names.length - 1} others`;

  return (
    <div className="mt-4 rounded-2xl border border-terra/30 bg-terra/[0.08] px-4 py-3 text-[15px] font-medium text-ink">
      👋 {who} nudged you — your pod's hoping to see you show up.
    </div>
  );
}
