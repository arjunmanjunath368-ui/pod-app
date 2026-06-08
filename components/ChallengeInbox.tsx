"use client";

import { useState } from "react";
import LogSheet from "./LogSheet";

export type IncomingChallenge = {
  id: string;
  fromName: string;
  title: string;
  link: string | null;
  note: string | null;
  podId: string;
  podName: string;
};

export default function ChallengeInbox({
  challenges,
  userId,
}: {
  challenges: IncomingChallenge[];
  userId: string;
}) {
  const [logPod, setLogPod] = useState<string | null>(null);

  if (challenges.length === 0) return null;

  return (
    <div className="mt-4 space-y-2.5">
      {challenges.map((c) => (
        <div
          key={c.id}
          className="rounded-2xl border border-terra/30 bg-terra/[0.07] p-4"
        >
          <div className="text-[12px] font-semibold uppercase tracking-wide text-terra">
            💪 {c.fromName.split(/\s+/)[0]} challenged you
          </div>
          <div className="mt-0.5 text-[12px] font-medium text-muted">
            in {c.podName}
          </div>
          <div className="mt-1.5 text-[17px] font-semibold leading-snug text-ink">
            {c.title}
          </div>
          {c.note && (
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              “{c.note}”
            </p>
          )}
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            {c.link
              ? "Open the workout to pick something that fits your time — do it, then log it to clear this."
              : "Get it in whenever works today, then log it to clear this."}
          </p>
          <div className="mt-3 flex items-center gap-2.5">
            {c.link ? (
              <>
                <a
                  href={c.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-terra px-4 py-2.5 text-[14px] font-semibold text-white transition active:scale-[0.98]"
                >
                  Open workout ↗
                </a>
                <button
                  onClick={() => setLogPod(c.podId)}
                  className="rounded-xl border border-line bg-card px-4 py-2.5 text-[14px] font-semibold text-ink-soft transition active:scale-[0.98]"
                >
                  Log it
                </button>
              </>
            ) : (
              <button
                onClick={() => setLogPod(c.podId)}
                className="rounded-xl bg-terra px-4 py-2.5 text-[14px] font-semibold text-white transition active:scale-[0.98]"
              >
                Log it
              </button>
            )}
          </div>
        </div>
      ))}

      {logPod && (
        <LogSheet
          open={!!logPod}
          onClose={() => setLogPod(null)}
          podId={logPod}
          userId={userId}
        />
      )}
    </div>
  );
}
