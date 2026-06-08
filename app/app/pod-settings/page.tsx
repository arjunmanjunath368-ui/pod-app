import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PodSettings from "@/components/PodSettings";
import { weekStartUtc } from "@/lib/week";
import { dayKeyInTz } from "@/lib/days";

export default async function PodSettingsPage({
  searchParams,
}: {
  searchParams: { pod?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("pod_members")
    .select(
      "pod_id, status, pause_until, pods(id, name, timezone, week_starts_on)"
    )
    .eq("user_id", user.id)
    .neq("status", "left");

  if (!memberships || memberships.length === 0) redirect("/app/start");

  const rows = memberships.map((m: any) => {
    const pod = Array.isArray(m.pods) ? m.pods[0] : m.pods;
    return {
      podId: m.pod_id as string,
      status: m.status as string,
      pauseUntil: (m.pause_until as string | null) ?? null,
      name: pod?.name ?? "Pod",
      tz: pod?.timezone ?? "UTC",
      wso: pod?.week_starts_on ?? 1,
    };
  });
  const current = rows.find((r) => r.podId === searchParams.pod) ?? rows[0];

  const { data: stakeRow } = await supabase
    .from("pod_stakes")
    .select("status")
    .eq("pod_id", current.podId)
    .maybeSingle();
  const stakesActive = stakeRow?.status === "active";

  const wsInstant = weekStartUtc(current.tz, current.wso);
  const currentWeekStart = dayKeyInTz(wsInstant, current.tz);
  const nextWeekStart = dayKeyInTz(
    new Date(wsInstant.getTime() + 7 * 86400000),
    current.tz
  );

  return (
    <main className="px-5 pb-16 pt-9">
      <Link
        href={`/app?pod=${current.podId}`}
        className="text-[15px] font-semibold text-muted"
      >
        ← Back
      </Link>

      <div className="mt-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
        Manage pod
      </div>
      <h1 className="mb-5 font-serif text-[26px] font-semibold leading-tight text-ink">
        {current.name}
      </h1>

      <PodSettings
        podId={current.podId}
        userId={user.id}
        initialStatus={current.status}
        podName={current.name}
        stakesActive={stakesActive}
        currentWeekStart={currentWeekStart}
        nextWeekStart={nextWeekStart}
        initialPauseUntil={current.pauseUntil}
      />

      <Link
        href={`/app/stakes?pod=${current.podId}`}
        className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-card p-4 transition active:scale-[0.99]"
      >
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink">Stakes</div>
          <p className="mt-1 text-[14px] text-muted">
            Put a number on the line each week.
          </p>
        </div>
        <span className="ml-3 text-muted">→</span>
      </Link>
    </main>
  );
}
