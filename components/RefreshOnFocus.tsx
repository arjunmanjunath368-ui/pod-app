"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// The router cache (staleTimes) keeps tab-switching instant, but that means
// returning to the app after a while can show slightly stale data. This
// refreshes the current screen's server data whenever the app comes back to
// the foreground — so a teammate's new log or updated standings show up right
// away — while leaving in-app navigation fast. Throttled so a quick tab-out and
// back doesn't refetch needlessly.
export default function RefreshOnFocus() {
  const router = useRouter();
  const lastRef = useRef(0);

  useEffect(() => {
    const maybeRefresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRef.current < 8000) return; // throttle: at most once / 8s
      lastRef.current = now;
      router.refresh();
    };
    document.addEventListener("visibilitychange", maybeRefresh);
    window.addEventListener("focus", maybeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", maybeRefresh);
      window.removeEventListener("focus", maybeRefresh);
    };
  }, [router]);

  return null;
}
