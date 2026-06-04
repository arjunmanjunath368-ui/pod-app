"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Listens for changes to member records (status/goals/joins) and profiles
// (name/photo) in the user's pods, and refreshes the server-rendered page so
// those propagate live — not just on manual reload. Reuses the feed's authed
// realtime pattern (the socket must carry the token or RLS blocks every event).
export default function PodSync() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: any = null;

    function scheduleRefresh() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    }

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel("pod-sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pod_members" },
          () => scheduleRefresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles" },
          () => scheduleRefresh()
        )
        .subscribe((status: string) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("pod sync realtime:", status);
          }
        });
    })();

    const { data: authSub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      if (channel) supabase.removeChannel(channel);
      authSub?.subscription?.unsubscribe();
    };
  }, [router]);

  return null;
}
