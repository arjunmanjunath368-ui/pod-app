"use client";

import { useState } from "react";
import CodeActions from "./CodeActions";

export default function InviteButton({
  code,
  podName,
}: {
  code: string;
  podName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-soft transition active:scale-95"
      >
        {open ? "Hide" : "Invite"}
      </button>

      {open && (
        <div className="mt-3 rounded-2xl bg-ink px-4 py-3 text-paper">
          <div className="text-[11px] uppercase tracking-wide text-sage-soft">
            Invite code
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="font-serif text-[22px] font-semibold tracking-[0.18em] text-gold">
              {code}
            </div>
            <CodeActions code={code} podName={podName} />
          </div>
        </div>
      )}
    </div>
  );
}
