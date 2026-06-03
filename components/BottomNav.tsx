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
  active: "home" | "pod" | "you";
  podId: string;
  userId: string;
  defaultActivity?: ActivityKey;
}) {
  const [open, setOpen] = useState(false);

  const itemCls = (on: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 text-[11px] font-semibold ${
      on ? "text-terra" : "text-muted"
    }`;

  return (
    <>
      <nav className="podnav border-t border-line bg-paper/95 backdrop-blur">
        <div className="flex items-end px-3 pb-6 pt-2.5">
          <Link href={`/app?pod=${podId}`} className={itemCls(active === "home")}>
            <span className="text-[20px]">🏠</span>
            Home
          </Link>

          <Link
            href={`/app/pod?pod=${podId}`}
            className={itemCls(active === "pod")}
          >
            <span className="text-[20px]">🫛</span>
            Pod
          </Link>

          <div className="flex flex-1 flex-col items-center">
            <button
              onClick={() => setOpen(true)}
              className="-mt-7 flex items-center justify-center rounded-full bg-terra text-white shadow-pod-lg transition active:scale-95"
              style={{ height: "60px", width: "60px" }}
              aria-label="Log a session"
            >
              <span className="text-[26px] leading-none">+</span>
            </button>
          </div>

          <Link href="/app/you" className={itemCls(active === "you")}>
            <span className="text-[20px]">🙂</span>
            You
          </Link>

          <div className="flex-1" aria-hidden="true" />
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
