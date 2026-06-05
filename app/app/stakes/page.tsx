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
    .neq("status", "left");
  // All members who haven't left — includes paused. computeStakes filters the pot
  // down to active-with-goal; paused members still appear in standings + must
  // consent (they're bound by the bet when they resume).
  const podMembers = (mems ?? []).map((m: any) => ({
    userId: m.user_id as string,
    name:
      (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles)?.display_name ??
      "Member",
    target: m.goal_target_per_week ?? 0,
    status: m.status as string,
  }));
  const nameOf = (id: string) =>
    podMembers.find((m) => m.userId === id)?.name ?? "Member";

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
      members: podMembers,
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
        members: podMembers,
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

    const netByUser: Record<string, number> = {};
    res.standings.forEach((s) => {
      netByUser[s.userId] = s.provNet;
    });
    const startedLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
      day: "numeric",
    }).format(new Date(`${stake.period_start}T12:00:00Z`));

    activeView = {
      stakeAmount: stake.stake_amount,
      periodWeeks: stake.period_weeks,
      displayWeek,
      daysLeft,
      startedLabel,
      // Show every member who hasn't left. Active-with-goal show a net; active
      // without a goal show "No goal set"; paused show "Paused" (not in the pot).
      standings: podMembers
        .map((m) => ({
          name: m.name,
          net: netByUser[m.userId] ?? 0,
          hasGoal: m.target >= 1,
          paused: m.status === "paused",
        }))
        .sort((a, b) => {
          const rank = (x: { paused: boolean; hasGoal: boolean }) =>
            x.paused ? 2 : x.hasGoal ? 0 : 1;
          if (rank(a) !== rank(b)) return rank(a) - rank(b);
          return b.net - a.net;
        }),
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
        <h1 className="mb-1 font-serif text-[26px] font-semibold leading-tight text-ink">
          Stakes
        </h1>
        <p className="mb-4 text-[14px] leading-relaxed text-muted">
          Put a number on the line each week. Hit your goal, stay in the green —
          the pod keeps score, and how you settle is up to you.
        </p>

        {rows.length === 1 ? (
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-2/50 px-3 py-1.5 text-[13px] font-semibold text-ink-soft">
            {current.name}
          </div>
        ) : (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {rows.map((r) => {
              const isCurrent = r.podId === current.podId;
              return (
                <a
                  key={r.podId}
                  href={`/app/stakes?pod=${r.podId}`}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                    isCurrent
                      ? "bg-ink text-paper"
                      : "border border-line bg-card text-ink-soft active:scale-95"
                  }`}
                >
                  {r.name}
                </a>
              );
            })}
          </div>
        )}

        <StakesPanel
          podId={current.podId}
          userId={user.id}
          isActiveMember={current.myStatus !== "left"}
          activeMembers={podMembers.map((m) => ({
            userId: m.userId,
            name: m.name,
            paused: m.status === "paused",
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
