import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import StakesPanel from "@/components/StakesPanel";
import { weekStartUtc } from "@/lib/week";

export default async function StakesPage({
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
    .select("pod_id, status, pods(id, name, timezone, week_starts_on)")
    .eq("user_id", user.id)
    .neq("status", "left");
  if (!memberships || memberships.length === 0) redirect("/app/start");

  const rows = memberships.map((m: any) => {
    const pod = Array.isArray(m.pods) ? m.pods[0] : m.pods;
    return {
      podId: m.pod_id as string,
      myStatus: m.status as string,
      name: pod?.name ?? "Pod",
      tz: pod?.timezone ?? "UTC",
      wso: pod?.week_starts_on ?? 1,
    };
  });
  const current = rows.find((r) => r.podId === searchParams.pod) ?? rows[0];

  // Active members of this pod (only these consent / count toward unanimity).
  const { data: mems } = await supabase
    .from("pod_members")
    .select("user_id, status, profiles(display_name)")
    .eq("pod_id", current.podId)
    .eq("status", "active");
  const activeMembers = (mems ?? []).map((m: any) => ({
    userId: m.user_id as string,
    name:
      (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles)?.display_name ??
      "Member",
  }));

  const { data: stake } = await supabase
    .from("pod_stakes")
    .select("*")
    .eq("pod_id", current.podId)
    .maybeSingle();

  const { data: consents } = await supabase
    .from("stake_consents")
    .select("user_id, proposal_id, agreed")
    .eq("pod_id", current.podId);

  const proposalId: string | null = stake?.proposal_id ?? null;
  const consentMap: Record<string, boolean | null> = {};
  (consents ?? []).forEach((c: any) => {
    if (c.proposal_id === proposalId) consentMap[c.user_id] = c.agreed;
  });

  // YYYY-MM-DD of the current week's start, in the pod's timezone.
  const ws = weekStartUtc(current.tz, current.wso);
  const currentWeekStart = new Intl.DateTimeFormat("en-CA", {
    timeZone: current.tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ws);

  const proposedByName =
    activeMembers.find((m) => m.userId === stake?.proposed_by)?.name ?? "Someone";

  const navPodId = current.podId;

  return (
    <>
      <main className="flex-1 overflow-y-auto px-5 pb-28 pt-9">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
          Stakes · {current.name}
        </div>
        <h1 className="mb-1 font-serif text-[26px] font-semibold leading-tight text-ink">
          Stakes
        </h1>
        <p className="mb-5 text-[14px] leading-relaxed text-muted">
          Put a number on the line each week. Pod keeps score — who's up, who's
          behind. How you settle is between you.
        </p>

        <StakesPanel
          podId={current.podId}
          userId={user.id}
          isActiveMember={current.myStatus === "active"}
          activeMembers={activeMembers}
          consentMap={consentMap}
          status={stake?.status ?? "off"}
          proposalId={proposalId}
          proposedById={stake?.proposed_by ?? null}
          proposedByName={proposedByName}
          propAmount={stake?.prop_amount ?? null}
          propWeeks={stake?.prop_weeks ?? null}
          stakeAmount={stake?.stake_amount ?? null}
          periodWeeks={stake?.period_weeks ?? null}
          periodStart={stake?.period_start ?? null}
          currentWeekStart={currentWeekStart}
        />
      </main>
      <BottomNav active="settings" podId={navPodId} userId={user.id} />
    </>
  );
}
