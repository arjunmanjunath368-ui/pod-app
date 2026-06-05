"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Mirrors stakes changes (proposals, consent votes, activation, extend, settle)
// across screens live, so a pod member sees others' responses without a manual
// refresh. Same authed-realtime pattern as PodSync — the socket must carry the
// token or RLS blocks every event. Scoped to one pod.
export default function StakesSync({ podId }: { podId: string }) {
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
        .channel("stakes-sync")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pod_stakes",
            filter: `pod_id=eq.${podId}`,
          },
          () => scheduleRefresh()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "stake_consents",
            filter: `pod_id=eq.${podId}`,
          },
          () => scheduleRefresh()
        )
        .subscribe((status: string) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("stakes sync realtime:", status);
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
  }, [router, podId]);

  return null;
}
