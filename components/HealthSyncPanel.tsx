"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function newToken(): string {
  // Two UUIDs concatenated — plenty of entropy for a bearer secret, no extra
  // dependency needed.
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

export default function HealthSyncPanel({
  userId,
  initialToken,
}: {
  userId: string;
  initialToken: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/health-import`
      : "";

  async function save(next: string | null) {
    setBusy(true);
    setErr("");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ health_sync_token: next })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setErr("Couldn't save — try again in a moment.");
      return;
    }
    setToken(next);
    router.refresh();
  }

  function copy(kind: "url" | "token", value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="text-[15px] font-semibold text-ink">
          ⌚ Auto-log from Apple Health
        </div>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
          Connect a companion app on your phone and finished workouts show up
          in Pod on their own — no manual logging. These never count toward
          stakes; a live photo is still how you verify a staked log.
        </p>
        {err && <p className="mt-2 text-[13px] text-terra">{err}</p>}
        <button
          onClick={() => save(newToken())}
          disabled={busy}
          className="mt-3 rounded-full bg-terra px-4 py-2 text-[14px] font-semibold text-paper disabled:opacity-50 active:scale-95"
        >
          {busy ? "Setting up…" : "Turn on"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sage/40 bg-sage/[0.08] p-4">
      <div className="text-[15px] font-semibold text-ink">
        ⌚ Auto-log from Apple Health — on
      </div>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
        Install <span className="font-semibold">Health Auto Export</span>{" "}
        from the App Store, add a new <span className="font-semibold">REST
        API</span> automation, and point it at:
      </p>

      <div className="mt-3 space-y-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            URL
          </div>
          <button
            onClick={() => copy("url", webhookUrl)}
            className="mt-0.5 block w-full truncate rounded-lg border border-line bg-paper px-3 py-2 text-left text-[13px] text-ink-soft active:scale-[0.99]"
          >
            {webhookUrl} · {copied === "url" ? "copied ✓" : "tap to copy"}
          </button>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Header
          </div>
          <button
            onClick={() => copy("token", `Authorization: Bearer ${token}`)}
            className="mt-0.5 block w-full truncate rounded-lg border border-line bg-paper px-3 py-2 text-left text-[13px] text-ink-soft active:scale-[0.99]"
          >
            Authorization: Bearer {token.slice(0, 10)}… ·{" "}
            {copied === "token" ? "copied ✓" : "tap to copy"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-[13px] text-muted">
        Set it to sync automatically, JSON format, workouts only. Any
        completed workout over 5 minutes will show up in your pods within a
        few minutes of your phone unlocking.
      </p>

      {err && <p className="mt-2 text-[13px] text-terra">{err}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => save(newToken())}
          disabled={busy}
          className="rounded-full border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-ink-soft disabled:opacity-50 active:scale-95"
        >
          Regenerate token
        </button>
        <button
          onClick={() => save(null)}
          disabled={busy}
          className="rounded-full border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-muted disabled:opacity-50 active:scale-95"
        >
          Turn off
        </button>
      </div>
    </div>
  );
}
