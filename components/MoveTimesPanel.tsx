"use client";

import { NudgeHoursEditor } from "@/components/home/NudgeTime";

// Settings: when Pod nudges the member, as exact times.
export default function MoveTimesPanel({
  userId,
  initialHours,
  available,
}: {
  userId: string;
  initialHours: number[];
  available: boolean; // false until the database update has been run
}) {
  return (
    <div id="move-times" className="scroll-mt-6 rounded-2xl border border-line bg-card p-4">
      <div className="text-[15px] font-semibold text-ink">🔔 Nudge times</div>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
        On a day you haven&apos;t moved yet, Pod sends one nudge at the first of these times, with who in your pod
        already showed up.
      </p>
      {available ? (
        <NudgeHoursEditor initialHours={initialHours} userId={userId} heading={false} />
      ) : (
        <p className="mt-3 text-[13px] text-muted">Available after the next update.</p>
      )}
    </div>
  );
}
