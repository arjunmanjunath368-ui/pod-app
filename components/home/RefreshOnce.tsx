"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the page once, e.g. after Home logged a rest day on the server
// so the pod card below catches up.
export default function RefreshOnce() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
