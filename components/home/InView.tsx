"use client";

import { useEffect, useRef, useState } from "react";

// Adds `in-view` once its contents scroll into view, so the charts inside can
// build (see .grow-y, .grow-x, .draw-line, .pop-in in globals.css).
export function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return { ref, seen };
}

export default function InView({
  children,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "ul" | "li";
}) {
  const { ref, seen } = useInView<HTMLElement>();
  const Tag = as as any;
  return (
    <Tag ref={ref} className={`${className} ${seen ? "in-view" : ""}`}>
      {children}
    </Tag>
  );
}

// A number that counts up from zero the first time it scrolls into view.
export function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const { ref, seen } = useInView<HTMLSpanElement>(0.4);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    // Counting runs with Reduce Motion on too: the digits change, nothing moves.
    if (!seen) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {seen ? shown : 0}
    </span>
  );
}
