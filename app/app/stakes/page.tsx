import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import StakesPanel from "@/components/StakesPanel";
import { weekStartUtc } from "@/lib/week";
import { dayKeyInTz } from "@/lib/days";
import { computeStakes, periodStartInstant } from "@/lib/stakes";

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
  const tz = current.tz;
  const wso = current.wso;

  const { data: mems } = await supabase
    .from("pod_members")
    .select("user_id, status, goal_target_per_week, profiles(display_name)")
    .eq("pod_id", current.podId)
    .eq("status", "active");
  const activeMembers = (mems ?? []).map((m: any) => ({
    userId: m.user_id as string,
    name:
      (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles)?.display_name ??
      "Member",
    target: m.goal_target_per_week ?? 0,
    status: m.status as string,
  }));
  const nameOf = (id: string) =>
    activeMembers.find((m) => m.userId === id)?.name ?? "Member";

  let { data: stake } = await supabase
    .from("pod_stakes")
    .select("*")
    .eq("pod_id", current.podId)
    .maybeSingle();

  // ---- Stage 2: lazy settlement + live standings (only when active) ----
  let activeView: any = null;
  if (stake?.status === "active" && stake.period_start) {
    const now = new Date();
    const startInstant0 = periodStartInstant(stake.period_start, tz, wso);
    const { data: sess } = await supabase
      .from("sessions")
      .select("user_id, logged_at")
      .eq("pod_id", current.podId)
      .gte("logged_at", startInstant0.toISOString());
    const sessions = (sess ?? []).map((s: any) => ({
      userId: s.user_id as string,
      loggedAt: new Date(s.logged_at),
    }));

    let periodStartDate: string = stake.period_start;
    let res = computeStakes({
      stakeAmount: stake.stake_amount,
      periodStartDate,
      periodWeeks: stake.period_weeks,
      tz,
      weekStartsOn: wso,
      members: activeMembers,
      sessions,
      now,
    });

    // Settle every fully-elapsed period (guarded by unique(pod_id,period_start)).
    for (let guard = 0; guard < 24 && res.isOver; guard++) {
      const periodEndDate = dayKeyInTz(res.periodEndInstant, tz);
      const results = res.standings.map((s) => ({
        userId: s.userId,
        net: s.firmNet,
      }));
      await supabase.from("stake_settlements").insert({
        pod_id: current.podId,
        period_start: periodStartDate,
        period_end: periodEndDate,
        results,
      }); // dup insert (already settled) errors harmlessly
      periodStartDate = periodEndDate;
      await supabase
        .from("pod_stakes")
        .update({ period_start: periodStartDate, updated_at: now.toISOString() })
        .eq("pod_id", current.podId);
      res = computeStakes({
        stakeAmount: stake.stake_amount,
        periodStartDate,
        periodWeeks: stake.period_weeks,
        tz,
        weekStartsOn: wso,
        members: activeMembers,
        sessions,
        now,
      });
    }

    const { data: setRows } = await supabase
      .from("stake_settlements")
      .select("period_start, period_end, results, settled_at")
      .eq("pod_id", current.podId)
      .order("settled_at", { ascending: false })
      .limit(1);
    const latest = setRows?.[0];

    const displayWeek =
      res.currentWeekIndex != null
        ? res.currentWeekIndex + 1
        : Math.min(res.weeksCompleted + 1, stake.period_weeks);
    const daysLeft = Math.max(
      0,
      Math.ceil((res.periodEndInstant.getTime() - now.getTime()) / 86400000)
    );

    activeView = {
      stakeAmount: stake.stake_amount,
      periodWeeks: stake.period_weeks,
      displayWeek,
      daysLeft,
      standings: res.standings
        .map((s) => ({ name: nameOf(s.userId), net: s.provNet }))
        .sort((a, b) => b.net - a.net),
      lastSettlement: latest
        ? {
            periodLabel: `${latest.period_start} → ${latest.period_end}`,
            rows: (latest.results as any[])
              .map((r) => ({ name: nameOf(r.userId), net: r.net }))
              .sort((a, b) => b.net - a.net),
          }
        : null,
    };
  }

  const { data: consents } = await supabase
    .from("stake_consents")
    .select("user_id, proposal_id, agreed")
    .eq("pod_id", current.podId);
  const proposalId: string | null = stake?.proposal_id ?? null;
  const consentMap: Record<string, boolean | null> = {};
  (consents ?? []).forEach((c: any) => {
    if (c.proposal_id === proposalId) consentMap[c.user_id] = c.agreed;
  });

  const ws = weekStartUtc(tz, wso);
  const currentWeekStart = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ws);

  const proposedByName = nameOf(stake?.proposed_by ?? "");

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
          activeMembers={activeMembers.map((m) => ({
            userId: m.userId,
            name: m.name,
          }))}
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
          activeView={activeView}
        />
      </main>
      <BottomNav active="settings" podId={current.podId} userId={user.id} />
    </>
  );
}
