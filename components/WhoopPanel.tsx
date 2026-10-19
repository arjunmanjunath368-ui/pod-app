"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const FLASH: Record<string, { text: string; good: boolean }> = {
  connected: {
    text: "WHOOP connected. Your recent workouts are syncing now.",
    good: true,
  },
  denied: {
    text: "No problem. You didn't approve access, so nothing was connected.",
    good: false,
  },
  error: { text: "Couldn't finish connecting. Please try again.", good: false },
  linked: {
    text: "That WHOOP account is already linked to another Pod account.",
    good: false,
  },
  consent: {
    text: "Please tick the box to agree before connecting.",
    good: false,
  },
  unavailable: { text: "WHOOP isn't set up on this Pod yet.", good: false },
  rest_on: {
    text: "Rest days are on. On a red-recovery day, tap Take a rest day on Home.",
    good: true,
  },
  rest_denied: {
    text: "WHOOP didn't share recovery, so rest days are still off.",
    good: false,
  },
};

export default function WhoopPanel({
  connected,
  needsReconnect,
  restOn,
  flash,
}: {
  connected: boolean;
  needsReconnect: boolean;
  restOn: boolean;
  flash: string | null;
}) {
  const router = useRouter();
  const [msg] = useState(flash ? (FLASH[flash] ?? null) : null);
  const [agree, setAgree] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removeLogs, setRemoveLogs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Rest days: an extra, separate opt-in (WHOOP recovery access).
  const [wantRest, setWantRest] = useState(false);
  const [restAgree, setRestAgree] = useState(false);
  const [restBusy, setRestBusy] = useState(false);
  const [restErr, setRestErr] = useState("");

  // Keep the one-shot result flag from lingering in the URL.
  useEffect(() => {
    if (flash) router.replace("/app/settings", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function connect() {
    if (!agree) return;
    const rest = wantRest || (needsReconnect && restOn);
    window.location.href = `/api/whoop/connect?consent=1${rest ? "&rest=1" : ""}`;
  }

  async function setRest(on: boolean) {
    setRestBusy(true);
    setRestErr("");
    try {
      const res = await fetch("/api/rest-day", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.status === "needs_permission") {
        // First time: WHOOP's own screen asks the member to share recovery.
        window.location.href = "/api/whoop/connect?consent=1&rest=1";
        return;
      }
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setRestErr("Couldn't change that. Try again in a moment.");
    }
    setRestBusy(false);
  }

  async function disconnect() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/whoop/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeWorkouts: removeLogs }),
      });
      if (!res.ok) throw new Error("failed");
      setConfirming(false);
      router.refresh();
    } catch {
      setErr("Couldn't disconnect — try again in a moment.");
    }
    setBusy(false);
  }

  const consentBlock = (
    <label className="mt-3 flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-soft">
      <input
        type="checkbox"
        checked={agree}
        onChange={(e) => setAgree(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#c8553d]"
      />
      <span>
        I agree that workouts synced from WHOOP (type, time and length) will be
        visible to the members of my pods.
      </span>
    </label>
  );

  const footer = (
    <p className="mt-3 text-[12px] leading-relaxed text-muted">
      Pod isn't affiliated with or endorsed by WHOOP. See our{" "}
      <Link href="/privacy" className="font-semibold underline">
        privacy policy
      </Link>
      . Questions: hello@podfitt.com
    </p>
  );

  return (
    <div
      className={`rounded-2xl border p-4 ${
        connected && !needsReconnect
          ? "border-sage/40 bg-sage/[0.08]"
          : "border-line bg-card"
      }`}
    >
      {msg && (
        <div
          className={`mb-3 rounded-xl px-3 py-2 text-[13px] ${
            msg.good ? "bg-sage/[0.18] text-ink" : "bg-terra/[0.1] text-terra"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="text-[15px] font-semibold text-ink">
        {connected && !needsReconnect
          ? "⌚ WHOOP — connected"
          : needsReconnect
            ? "⌚ WHOOP — reconnect needed"
            : "⌚ Connect WHOOP"}
      </div>

      {!connected && (
        <>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
            Needs a WHOOP membership. Finished activities show up in your pods
            automatically. Pod uses only the activity type, start time and
            length. It never reads strain, heart rate, calories or sleep, and
            reads recovery only if you turn on rest days. Synced activities
            never count toward stakes.
          </p>
          {consentBlock}
          <label className="mt-2.5 flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-soft">
            <input
              type="checkbox"
              checked={wantRest}
              onChange={(e) => setWantRest(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#c8553d]"
            />
            <span>
              Optional: also turn on rest days. When WHOOP puts my recovery in
              the red, a rest day counts toward my week. Pod checks the score
              only when I tap Take a rest day and never stores it.
            </span>
          </label>
          <button
            onClick={connect}
            disabled={!agree}
            className="mt-3 rounded-full bg-terra px-4 py-2 text-[14px] font-semibold text-paper transition disabled:opacity-40 active:scale-95"
          >
            Connect WHOOP
          </button>
          {footer}
        </>
      )}

      {connected && needsReconnect && (
        <>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
            WHOOP stopped accepting this connection, so new workouts aren't
            syncing. Reconnect to pick up where you left off.
          </p>
          {consentBlock}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={connect}
              disabled={!agree}
              className="rounded-full bg-terra px-4 py-2 text-[14px] font-semibold text-paper transition disabled:opacity-40 active:scale-95"
            >
              Reconnect
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="rounded-full border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-muted active:scale-95"
            >
              Disconnect
            </button>
          </div>
        </>
      )}

      {connected && !needsReconnect && (
        <>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
            Activities you finish on WHOOP appear in your pods once WHOOP has
            processed them, usually within a few minutes.
          </p>

          <div className="mt-3 rounded-xl border border-line bg-paper p-3">
            <div className="text-[14px] font-semibold text-ink">
              💤 Rest days {restOn ? "· on" : ""}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {restOn
                ? "On a day WHOOP puts your recovery in the red, tap Take a rest day on Home and it counts toward your week, up to 2 a week. Pod checks the score only when you tap, never stores it, and your pod only sees that you rested."
                : "Showing up includes recovering. Turn this on and, when WHOOP puts your recovery in the red, a rest day counts toward your week (up to 2 a week). Rest days never count toward stakes."}
            </p>
            {!restOn && (
              <label className="mt-2 flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-soft">
                <input
                  type="checkbox"
                  checked={restAgree}
                  onChange={(e) => setRestAgree(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#c8553d]"
                />
                <span>
                  I agree that Pod can check today's WHOOP recovery score when I
                  tap Take a rest day. It's never stored or shown to my pod.
                </span>
              </label>
            )}
            {restErr && <p className="mt-2 text-[13px] text-terra">{restErr}</p>}
            <button
              onClick={() => setRest(!restOn)}
              disabled={restBusy || (!restOn && !restAgree)}
              className={`mt-2.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition disabled:opacity-40 active:scale-95 ${
                restOn ? "border border-line bg-card text-muted" : "bg-ink text-paper"
              }`}
            >
              {restBusy ? "Saving…" : restOn ? "Turn off rest days" : "Turn on rest days"}
            </button>
          </div>

          {!confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="mt-3 rounded-full border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-muted active:scale-95"
            >
              Disconnect
            </button>
          )}
        </>
      )}

      {connected && confirming && (
        <div className="mt-3 rounded-xl border border-line bg-paper p-3">
          <div className="text-[14px] font-semibold text-ink">
            Disconnect WHOOP?
          </div>
          <label className="mt-2 flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-soft">
            <input
              type="checkbox"
              checked={removeLogs}
              onChange={(e) => setRemoveLogs(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#c8553d]"
            />
            <span>
              Also remove workouts synced from WHOOP from my pods (this can
              lower your weekly count).
            </span>
          </label>
          {err && <p className="mt-2 text-[13px] text-terra">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={disconnect}
              disabled={busy}
              className="rounded-full bg-terra px-4 py-2 text-[13px] font-semibold text-paper disabled:opacity-50 active:scale-95"
            >
              {busy ? "Disconnecting…" : "Disconnect"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-full border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-muted active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {connected && footer}
    </div>
  );
}
