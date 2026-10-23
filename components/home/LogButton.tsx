"use client";

import { useState } from "react";

// Opens the same log sheet as the + in the bottom nav (BottomNav listens for
// this event), so there is only ever one sheet on the page.
export function OpenLogButton({ label = "Log an activity" }: { label?: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("pod:log"))}
      className="w-full rounded-full bg-terra py-3 text-[17px] font-semibold text-paper transition active:scale-[0.98]"
    >
      {label}
    </button>
  );
}

// Demo pod only: sends the member a real sample notification, so the nudge
// can be shown on a phone.
export function SampleNudgeButton({ title, body }: { title: string; body: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "off">("idle");
  async function send() {
    setState("busy");
    try {
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ self: true, title, body, url: "/app/demo" }),
      });
      const j = await res.json().catch(() => ({}));
      setState(res.ok && (j.sent ?? 1) > 0 ? "sent" : "off");
    } catch {
      setState("off");
    }
  }
  return (
    <div>
      <button
        onClick={send}
        disabled={state === "busy"}
        className="w-full rounded-full bg-terra py-3 text-[17px] font-semibold text-paper transition active:scale-[0.98] disabled:opacity-60"
      >
        {state === "busy" ? "Sending…" : state === "sent" ? "Sent. Check your lock screen" : "Send me this nudge"}
      </button>
      {state === "off" && (
        <p className="mt-2 text-center text-[14px] text-muted">
          Turn on notifications in Settings first, then try again.
        </p>
      )}
    </div>
  );
}
