"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LeavePodButton({
  podId,
  userId,
  podName,
}: {
  podId: string;
  userId: string;
  podName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function leave() {
    if (
      !confirm(
        `Leave "${podName}"? You'll stop appearing in this pod. You can rejoin later with the invite code.`
      )
    )
      return;
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("pod_members")
      .update({ status: "left" })
      .eq("pod_id", podId)
      .eq("user_id", userId);
    setBusy(false);
    router.push("/app");
    router.refresh();
  }

  return (
    <button
      onClick={leave}
      disabled={busy}
      className="text-[13px] font-semibold text-muted transition active:scale-95"
    >
      Leave
    </button>
  );
}
