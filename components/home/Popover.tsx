"use client";

import { useEffect, useRef, useState } from "react";

// A small menu that opens under its button and closes on an outside tap.
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export const MENU_CLS =
  "absolute left-0 top-full z-30 mt-2 min-w-[220px] overflow-hidden rounded-2xl bg-card py-1.5 shadow-pod-lg ring-1 ring-line";
export const MENU_ITEM_CLS =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[17px] text-ink transition active:bg-paper-2";
