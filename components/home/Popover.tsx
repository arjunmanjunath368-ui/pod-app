"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Room kept clear at the bottom of the screen for the fixed bar (bottom nav or
// demo pager), so a menu never opens underneath it.
const BOTTOM_BAR = 104;
const GAP = 8;

// A small menu that closes on an outside tap. It opens under its anchor when
// there's room, otherwise above it; if neither side fits, it scrolls inside.
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<{ up: boolean; max?: number }>({ up: false });

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = ref.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const h = menu.scrollHeight;
    const below = window.innerHeight - BOTTOM_BAR - anchor.bottom - GAP;
    const above = anchor.top - GAP - 12;
    if (h <= below) setPlace({ up: false });
    else if (above >= below) setPlace({ up: true, max: h > above ? above : undefined });
    else setPlace({ up: false, max: below });
  }, [open]);

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

  const menuProps = {
    ref: menuRef,
    style: place.max ? { maxHeight: place.max, overflowY: "auto" as const } : undefined,
    pos: place.up ? "bottom-full mb-2" : "top-full mt-2",
  };
  return { open, setOpen, ref, menu: menuProps };
}

export const MENU_CLS =
  "absolute left-0 z-30 min-w-[220px] overflow-hidden rounded-2xl bg-card py-1.5 shadow-pod-lg ring-1 ring-line";
export const MENU_ITEM_CLS =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[17px] text-ink transition active:bg-paper-2";
