"use client";

import { useState } from "react";

// Demo: Pod AI spots a family member struggling with something you've
// improved, finds what worked in your own data, and drafts the message.
export default function FamilyInsight({
  name,
  insight,
  draft,
}: {
  name: string;
  insight: React.ReactNode;
  draft: string;
}) {
  const [step, setStep] = useState<"idle" | "draft" | "sent" | "dismissed">("idle");
  if (step === "dismissed") return null;
  return (
    <section className="mt-5 rounded-[28px] border border-terra/30 bg-card p-5 shadow-pod">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-terra">
        <span aria-hidden>✦</span> Pod AI noticed
      </div>
      <div className="mt-2 text-[16px] leading-relaxed text-ink">{insight}</div>

      {step === "idle" && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setStep("draft")}
            className="flex-1 rounded-full bg-terra px-4 py-2.5 text-[14px] font-semibold text-paper transition active:scale-[0.98]"
          >
            Share what worked
          </button>
          <button
            onClick={() => setStep("dismissed")}
            className="shrink-0 rounded-full border border-line bg-paper px-4 py-2.5 text-[14px] font-semibold text-ink-soft transition active:scale-[0.98]"
          >
            Not now
          </button>
        </div>
      )}

      {step !== "idle" && (
        <div className="mt-4">
          <div className="text-[12px] font-semibold text-muted">Your message to {name}, drafted</div>
          <p className="mt-1.5 rounded-2xl bg-paper-2/70 p-3.5 text-[15px] leading-relaxed text-ink">{draft}</p>
          <button
            onClick={() => setStep("sent")}
            disabled={step === "sent"}
            className={`mt-3 w-full rounded-full px-4 py-2.5 text-[14px] font-semibold transition active:scale-[0.98] ${
              step === "sent" ? "bg-paper-2 text-muted" : "bg-terra text-paper"
            }`}
          >
            {step === "sent" ? `Sent to ${name} ✓` : `Send to ${name}`}
          </button>
        </div>
      )}
    </section>
  );
}
