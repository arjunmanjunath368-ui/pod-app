"use client";

import { useState } from "react";
import Link from "next/link";
import LogSheet from "./LogSheet";
import { type ActivityKey } from "@/lib/activities";

const ICON = {
  width: 23,
  height: 23,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function HomeIcon() {
  return (
    <svg {...ICON}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.8V20h14V9.8" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}
function YouIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="6.5" />
      <line x1="12" y1="2" x2="12" y2="5.5" />
      <line x1="12" y1="18.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5.5" y2="12" />
      <line x1="18.5" y1="12" x2="22" y2="12" />
      <line x1="5.4" y1="5.4" x2="7.6" y2="7.6" />
      <line x1="16.4" y1="16.4" x2="18.6" y2="18.6" />
      <line x1="5.4" y1="18.6" x2="7.6" y2="16.4" />
      <line x1="16.4" y1="7.6" x2="18.6" y2="5.4" />
    </svg>
  );
}

export default function BottomNav({
  active,
  podId,
  userId,
  defaultActivity,
}: {
  active: "home" | "pod" | "you" | "settings";
  podId: string;
  userId: string;
  defaultActivity?: ActivityKey;
}) {
  const [open, setOpen] = useState(false);

  const itemCls = (on: boolean) =>
    `flex flex-1 flex-col items-center gap-1 text-[12px] font-semibold ${
      on ? "text-terra" : "text-muted"
    }`;

  return (
    <>
      <nav className="podnav border-t border-line bg-paper/95 backdrop-blur">
        <div className="flex items-end px-2 pb-6 pt-2.5">
          <Link href={`/app?pod=${podId}`} className={itemCls(active === "home")}>
            <HomeIcon />
            Home
          </Link>

          <Link
            href={`/app/pod?pod=${podId}`}
            className={itemCls(active === "pod")}
          >
            <span className="text-[21px] leading-none">🫛</span>
            My Pods
          </Link>

          <div className="flex flex-1 flex-col items-center">
            <button
              onClick={() => setOpen(true)}
              className="-mt-7 flex items-center justify-center rounded-full bg-terra text-white shadow-pod-lg transition active:scale-95"
              style={{ height: "60px", width: "60px" }}
              aria-label="Log a session"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          <Link href="/app/you" className={itemCls(active === "you")}>
            <YouIcon />
            You
          </Link>

          <Link
            href={`/app/settings?pod=${podId}`}
            className={itemCls(active === "settings")}
          >
            <SettingsIcon />
            Settings
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
