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
            💪 {c.fromName.split(/\s+/)[0]} challenged you · {c.podName}
          </div>
          <div className="mt-1 text-[16px] font-semibold leading-snug text-ink">
            {c.title}
          </div>
          {c.note && (
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              “{c.note}”
            </p>
          )}
          <div className="mt-3 flex items-center gap-2.5">
            <button
              onClick={() => setLogPod(c.podId)}
              className="rounded-xl bg-terra px-4 py-2.5 text-[14px] font-semibold text-white transition active:scale-[0.98]"
            >
              Log it
            </button>
            {c.link && (
              <a
                href={c.link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-line bg-card px-4 py-2.5 text-[14px] font-semibold text-ink-soft transition active:scale-[0.98]"
              >
                Open workout ↗
              </a>
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
