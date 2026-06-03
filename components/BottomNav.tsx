"use client";

import { useState } from "react";
import Link from "next/link";
import LogSheet from "./LogSheet";
import { type ActivityKey } from "@/lib/activities";

export default function BottomNav({
  active,
  podId,
  userId,
  defaultActivity,
}: {
  active: "home" | "you";
  podId: string;
  userId: string;
  defaultActivity?: ActivityKey;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="podnav border-t border-line bg-paper/95 backdrop-blur">
        <div className="flex items-center justify-around px-6 pb-6 pt-2.5">
          <Link
            href={`/app?pod=${podId}`}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold ${
              active === "home" ? "text-terra" : "text-muted"
            }`}
          >
            <span className="text-[20px]">🏠</span>
            Home
          </Link>

          <button
            onClick={() => setOpen(true)}
            className="-mt-7 flex h-15 w-15 flex-col items-center justify-center rounded-full bg-terra text-white shadow-pod-lg transition active:scale-95"
            style={{ height: "60px", width: "60px" }}
            aria-label="Log a session"
          >
            <span className="text-[26px] leading-none">+</span>
          </button>

          <Link
            href="/app/you"
            className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold ${
              active === "you" ? "text-terra" : "text-muted"
            }`}
          >
            <span className="text-[20px]">🙂</span>
            You
          </Link>
        </div>
      </nav>

      <LogSheet
        open={open}
        onClose={() => setOpen(false)}
        podId={podId}
        userId={userId}
        defaultActivity={defaultActivity}
      />
    </>
  );
}
