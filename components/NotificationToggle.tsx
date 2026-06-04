"use client";

import { useEffect, useState } from "react";
import {
  enablePush,
  sendTestPush,
  pushSupported,
  isIOS,
  isStandalone,
} from "@/lib/push";

export default function NotificationToggle({ userId }: { userId: string }) {
  const [status, setStatus] = useState<"unknown" | "on" | "off">("unknown");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!pushSupported()) {
      setStatus("off");
      return;
    }
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setStatus(sub ? "on" : "off"))
        .catch(() => setStatus("off"));
    } else {
      setStatus("off");
    }
  }, []);

  async function turnOn() {
    setBusy(true);
    setMsg("");
    const r = await enablePush(userId);
    setBusy(false);
    if (r === "ok") {
      setStatus("on");
      setMsg("Notifications are on.");
    } else if (r === "needs-install") {
      setMsg(
        "On iPhone, add Pod to your home screen first, then open it from there to turn on notifications."
      );
    } else if (r === "denied") {
      setMsg(
        "Notifications are blocked. Turn them on for this site in your browser settings."
      );
    } else if (r === "unsupported") {
      setMsg("This browser doesn't support notifications.");
    } else {
      setMsg("Couldn't enable notifications. Please try again.");
    }
  }

  async function test() {
    setBusy(true);
    setMsg("");
    const ok = await sendTestPush();
    setBusy(false);
    setMsg(
      ok
        ? "Test sent — it should pop up in a moment."
        : "Couldn't send the test. Make sure notifications are on."
    );
  }

  const iosNotInstalled = isIOS() && !isStandalone();

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="text-[15px] font-semibold text-ink">Notifications</div>
      <p className="mt-1 text-[14px] leading-relaxed text-muted">
        Get a nudge when your pod needs you — reminders and pokes from teammates.
      </p>

      {iosNotInstalled ? (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          On iPhone, first add Pod to your home screen (Share → Add to Home
          Screen), then open it from the home-screen icon to enable
          notifications.
        </p>
      ) : status === "on" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/15 px-3 py-1.5 text-[13px] font-semibold text-ink-soft">
            ✓ On
          </span>
          <button
            onClick={test}
            disabled={busy}
            className="rounded-full border border-line bg-paper-2/50 px-4 py-1.5 text-[13px] font-semibold text-ink-soft transition active:scale-95 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send a test"}
          </button>
        </div>
      ) : (
        <button
          onClick={turnOn}
          disabled={busy || status === "unknown"}
          className="mt-3 rounded-full bg-terra px-4 py-2 text-[14px] font-semibold text-white transition active:scale-95 disabled:opacity-60"
        >
          {busy ? "Turning on…" : "Turn on notifications"}
        </button>
      )}

      {msg && <p className="mt-3 text-[13px] text-ink-soft">{msg}</p>}
    </div>
  );
}
