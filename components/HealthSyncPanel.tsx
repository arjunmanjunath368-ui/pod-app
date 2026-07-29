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
  const [showGuide, setShowGuide] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/health-import`
      : "";
  const headerValue = token ? `Bearer ${token}` : "";

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
            className="mt-0.5 flex w-full items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-left active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
              {webhookUrl}
            </span>
            <span className="shrink-0 text-[12px] font-semibold text-terra">
              {copied === "url" ? "Copied ✓" : "Copy"}
            </span>
          </button>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Header — Key: <span className="normal-case">Authorization</span>
          </div>
          {/* Copies ONLY the value-field content ("Bearer <token>") — the app
              has separate Key/Value fields, so copying the combined
              "Authorization: Bearer …" line would wrongly duplicate the word
              "Authorization" if pasted straight into Value. */}
          <button
            onClick={() => copy("token", headerValue)}
            className="mt-0.5 flex w-full items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-left active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
              {headerValue}
            </span>
            <span className="shrink-0 text-[12px] font-semibold text-terra">
              {copied === "token" ? "Copied ✓" : "Copy"}
            </span>
          </button>
          <p className="mt-0.5 text-[12px] text-muted">
            This is the <span className="font-semibold">Value</span> field
            only — type <span className="font-semibold">Authorization</span>{" "}
            into Key yourself.
          </p>
        </div>
      </div>

      <button
        onClick={() => setShowGuide((s) => !s)}
        className="mt-3 text-[13px] font-semibold text-terra active:scale-95"
      >
        {showGuide ? "▾ Hide full setup steps" : "▸ Show full setup steps"}
      </button>

      {showGuide && (
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-ink-soft">
          <li>
            Install <span className="font-semibold">Health Auto Export</span>{" "}
            from the App Store. The REST API automation used here needs its{" "}
            <span className="font-semibold">Premium</span> tier — there's a
            free 7-day trial, then it's a paid tier. The free version alone
            won't unlock this.
          </li>
          <li>
            Open it → <span className="font-semibold">Automated Exports</span>{" "}
            → <span className="font-semibold">New Automation</span> → choose{" "}
            <span className="font-semibold">REST API</span>. Name it "Pod."
          </li>
          <li>
            Tap into the <span className="font-semibold">URL</span> field,
            come back here, tap <span className="font-semibold">Copy</span> on
            the URL above, and paste it in.
          </li>
          <li>
            Tap <span className="font-semibold">Add Headers</span>. For{" "}
            <span className="font-semibold">Key</span>, type{" "}
            <span className="font-semibold">Authorization</span>. For{" "}
            <span className="font-semibold">Value</span>, come back here, tap{" "}
            <span className="font-semibold">Copy</span> on the header above,
            and paste it in.
          </li>
          <li>
            Under <span className="font-semibold">Data Type</span>, choose{" "}
            <span className="font-semibold">Workouts</span> — not Health
            Metrics.
          </li>
          <li>
            Under <span className="font-semibold">Workout Configuration</span>
            , leave "Include Route Data" <span className="font-semibold">off</span>{" "}
            (Pod doesn't use location data, and it's the main cause of oversized
            payload errors). "Include Workout Metrics" is{" "}
            <span className="font-semibold">optional</span> — turn it on if you
            want calories to show up alongside your synced workouts (duration
            shows either way); it does add a little processing time per export.
          </li>
          <li>
            <span className="font-semibold">Export Format:</span> JSON.{" "}
            <span className="font-semibold">Export Version:</span> 2 (or
            "Current").
          </li>
          <li>
            <span className="font-semibold">Date Range:</span> "Since Last
            Sync."
          </li>
          <li>Save it.</li>
          <li>
            To test right away instead of waiting: open that automation →{" "}
            <span className="font-semibold">Manual Export</span> → pick
            "Today" → Export. Check{" "}
            <span className="font-semibold">View Activity Logs</span> for a
            success response.
          </li>
        </ol>
      )}

      <p className="mt-3 text-[13px] text-muted">
        Any completed workout over 5 minutes will show up in your pods within
        a few minutes of your phone unlocking — background sync is at iOS's
        discretion, not instant.
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

