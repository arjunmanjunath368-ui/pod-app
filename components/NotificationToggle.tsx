"use client";

import { useEffect, useState } from "react";
import {
  enablePush,
  disablePush,
  pushSupported,
  isIOS,
  isStandalone,
} from "@/lib/push";

export default function NotificationToggle({ userId }: { userId: string }) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const iosNotInstalled = isIOS() && !isStandalone();
  const supported = pushSupported() && !iosNotInstalled;

  useEffect(() => {
    if (!pushSupported()) {
      setReady(true);
      return;
    }
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setOn(!!sub))
        .catch(() => setOn(false))
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  async function toggle() {
    if (busy || !supported) return;
    setBusy(true);
    setMsg("");
    if (on) {
      await disablePush(userId);
      setOn(false);
      setBusy(false);
      return;
    }
    const r = await enablePush(userId);
    setBusy(false);
    if (r === "ok") {
      setOn(true);
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

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink">Notifications</div>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            Get a nudge when your pod needs you.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label="Toggle notifications"
          onClick={toggle}
          disabled={busy || !ready || !supported}
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
            on ? "bg-terra" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
              on ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {iosNotInstalled && (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          On iPhone, add Pod to your home screen (Share → Add to Home Screen),
          then open it from the icon to turn on notifications.
        </p>
      )}
      {msg && <p className="mt-3 text-[13px] text-ink-soft">{msg}</p>}
    </div>
  );
}
