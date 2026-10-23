"use client";

import { NudgeHoursEditor } from "./NudgeTime";

// Set a nudge time right from Home, for members who haven't yet. One compact
// dropdown; Settings has the same editor.
export default function MoveTimesQuick({ userId }: { userId: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-[18px]">🔔</span>
        <h3 className="text-[16px] font-semibold text-ink">When should Pod nudge you?</h3>
      </div>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
        If you haven&apos;t moved by then, you get one nudge with who in your pod already showed up.
      </p>
      <NudgeHoursEditor initialHours={[]} userId={userId} heading={false} />
    </div>
  );
}
