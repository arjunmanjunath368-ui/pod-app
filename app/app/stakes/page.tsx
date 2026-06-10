import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import StakesPanel from "@/components/StakesPanel";
import StakesSync from "@/components/StakesSync";
import Link from "next/link";
import { weekStartUtc } from "@/lib/week";
import { dayKeyInTz } from "@/lib/days";
import { computeStakes, periodStartInstant } from "@/lib/stakes";
import { parseGoal } from "@/lib/goals";

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
    .select(
      "user_id, status, goal_activity, goal_target_per_week, goal_mode, goal_activities, goal_splits, staked_from, profiles(display_name)"
    )
    .eq("pod_id", current.podId)
    .neq("status", "left");
  // All members who haven't left — includes paused. computeStakes filters the pot
  // down to active-with-goal; paused members still appear in standings + must
  // consent (they're bound by the bet when they resume).
  const podMembers = (mems ?? []).map((m: any) => {
    const g = parseGoal(m);
    return {
      userId: m.user_id as string,
      name:
        (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles)
          ?.display_name ?? "Member",
      target: g.target,
      status: m.status as string,
      stakedFrom: (m.staked_from as string | null) ?? null,
      mode: g.mode,
      splits: g.splits,
    };
  });
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
      .select("user_id, logged_at, activity, activities")
      .eq("pod_id", current.podId)
      .gte("logged_at", startInstant0.toISOString());
    const sessions = (sess ?? []).map((s: any) => ({
      userId: s.user_id as string,
      loggedAt: new Date(s.logged_at),
      activity: (s.activity as string | null) ?? null,
      activities: (s.activities as string[] | null) ?? null,
    }));

    // Frozen per-week rosters (pause fairness): who was staked each week. Once a
    // week closes, its roster never changes — so resuming can't rewrite history.
    const { data: wpRows } = await supabase
      .from("stake_week_participants")
      .select("week_start, user_id")
      .eq("pod_id", current.podId)
      .gte("week_start", stake.period_start);
    const weekRosters: Record<string, string[]> = {};
    (wpRows ?? []).forEach((r: any) => {
      (weekRosters[r.week_start] ??= []).push(r.user_id as string);
    });

    let periodStartDate: string = stake.period_start;
    let res = computeStakes({
      stakeAmount: stake.stake_amount,
      periodStartDate,
      periodWeeks: stake.period_weeks,
      tz,
      weekStartsOn: wso,
      members: podMembers,
      sessions,
      weekRosters,
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
        weekRosters,
        now,
      });
    }

    // Keep the CURRENT (open) week's roster in sync with live status: active
    // members with a goal whose staked_from is on or before this week. Pausing
    // drops you from the live week; "start next Monday" on resume keeps you out
    // until staked_from catches up. Closed weeks are left frozen.
    if (res.currentWeekStartKey) {
      const key = res.currentWeekStartKey;
      const eligible = podMembers
        .filter(
          (m) =>
            m.status === "active" &&
            m.target >= 1 &&
            (!m.stakedFrom || m.stakedFrom <= key)
        )
        .map((m) => m.userId);
      const existing = weekRosters[key] ?? [];
      const toDelete = existing.filter((id) => !eligible.includes(id));
      const toInsert = eligible.filter((id) => !existing.includes(id));
      for (const id of toDelete) {
        await supabase
          .from("stake_week_participants")
          .delete()
          .eq("pod_id", current.podId)
          .eq("week_start", key)
          .eq("user_id", id);
      }
      if (toInsert.length > 0) {
        await supabase.from("stake_week_participants").insert(
          toInsert.map((id) => ({
            pod_id: current.podId,
            week_start: key,
            user_id: id,
          }))
        );
      }
      if (toDelete.length > 0 || toInsert.length > 0) {
        weekRosters[key] = eligible;
        res = computeStakes({
          stakeAmount: stake.stake_amount,
          periodStartDate,
          periodWeeks: stake.period_weeks,
          tz,
          weekStartsOn: wso,
          members: podMembers,
          sessions,
          weekRosters,
          now,
        });
      }
    }

    // ---- Stage 9: reconcile a pending action (extend / settle) on this period.
    // The client only records the proposal + consent votes; the server applies
    // it here once every non-left member agrees, or clears it if anyone declines.
    if (stake.pending_action && stake.pending_proposal_id) {
      const { data: pc } = await supabase
        .from("stake_consents")
        .select("user_id, agreed")
        .eq("pod_id", current.podId)
        .eq("proposal_id", stake.pending_proposal_id);
      const declined = (pc ?? []).some((c: any) => c.agreed === false);
      const agreedCount = (pc ?? []).filter((c: any) => c.agreed === true).length;
      const clearPending = {
        pending_action: null,
        pending_proposal_id: null,
        pending_by: null,
        pending_weeks: null,
      };
      if (declined) {
        await supabase
          .from("pod_stakes")
          .update({ ...clearPending, updated_at: now.toISOString() })
          .eq("pod_id", current.podId);
        stake.pending_action = null;
      } else if (podMembers.length > 0 && agreedCount >= podMembers.length) {
        if (
          stake.pending_action === "reschedule" ||
          stake.pending_action === "extend"
        ) {
          // 'reschedule' = absolute new total weeks (earlier or later);
          // 'extend' = legacy delta (kept so an in-flight proposal still applies).
          const minW =
            res.currentWeekIndex != null
              ? res.currentWeekIndex + 1
              : res.weeksCompleted + 1;
          const target =
            stake.pending_action === "reschedule"
              ? stake.pending_weeks ?? stake.period_weeks
              : stake.period_weeks + (stake.pending_weeks ?? 0);
          const newWeeks = Math.max(minW, target);
          await supabase
            .from("pod_stakes")
            .update({
              period_weeks: newWeeks,
              ...clearPending,
              updated_at: now.toISOString(),
            })
            .eq("pod_id", current.podId);
          stake.period_weeks = newWeeks;
          stake.pending_action = null;
          res = computeStakes({
            stakeAmount: stake.stake_amount,
            periodStartDate,
            periodWeeks: newWeeks,
            tz,
            weekStartsOn: wso,
            members: podMembers,
            sessions,
            weekRosters,
            now,
          });
        } else if (stake.pending_action === "settle") {
          // Settle the completed weeks only (firmNet). An in-progress partial
          // week is voided — nobody forfeits a week that didn't finish.
          const periodEndDate = dayKeyInTz(now, tz);
          const results = res.standings.map((s) => ({
            userId: s.userId,
            net: s.firmNet,
          }));
          await supabase.from("stake_settlements").insert({
            pod_id: current.podId,
            period_start: periodStartDate,
            period_end: periodEndDate,
            results,
          });
          await supabase
            .from("pod_stakes")
            .update({
              status: "off",
              proposal_id: null,
              proposed_by: null,
              prop_amount: null,
              prop_weeks: null,
              period_start: null,
              ...clearPending,
              updated_at: now.toISOString(),
            })
            .eq("pod_id", current.podId);
          stake.status = "off";
          stake.pending_action = null;
        }
      }
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
    const startLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(`${stake.period_start}T12:00:00Z`));
    const notStartedYet = now.getTime() < startInstant0.getTime();

    activeView = {
      stakeAmount: stake.stake_amount,
      periodWeeks: stake.period_weeks,
      displayWeek,
      daysLeft,
      startedLabel,
      startLabel,
      notStartedYet,
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
  const pendingProposalId: string | null = stake?.pending_proposal_id ?? null;
  // The roster reflects whichever consent round is live: the pending action when
  // active, otherwise the activation proposal.
  const relevantProposalId: string | null =
    stake?.status === "active" && stake?.pending_action
      ? pendingProposalId
      : stake?.status === "proposed"
        ? proposalId
        : null;
  const consentMap: Record<string, boolean | null> = {};
  (consents ?? []).forEach((c: any) => {
    if (c.proposal_id === relevantProposalId) consentMap[c.user_id] = c.agreed;
  });

  // Most recent settlement — shown in the OFF state too, so an early-settle
  // result doesn't vanish the moment stakes turn off.
  let offLastSettlement: any = null;
  if (stake?.status !== "active") {
    const { data: lastSet } = await supabase
      .from("stake_settlements")
      .select("period_start, period_end, results")
      .eq("pod_id", current.podId)
      .order("settled_at", { ascending: false })
      .limit(1);
    const ls = lastSet?.[0];
    if (ls) {
      offLastSettlement = {
        periodLabel: `${ls.period_start} → ${ls.period_end}`,
        rows: (ls.results as any[])
          .map((r) => ({ name: nameOf(r.userId), net: r.net }))
          .sort((a, b) => b.net - a.net),
      };
    }
  }

  const ws = weekStartUtc(tz, wso);
  const currentWeekStart = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ws);

  // Option A: a stakes period is always whole pod-weeks. Begin this week only if
  // activating ON the week-start day; otherwise begin next week so Week 1 is a
  // full week (no half-week shortchange for activating mid-week).
  const todayKey = dayKeyInTz(new Date(), tz);
  const nextWeekStart = dayKeyInTz(
    new Date(ws.getTime() + 7 * 86400000),
    tz
  );
  const firstPeriodStart =
    todayKey === currentWeekStart ? currentWeekStart : nextWeekStart;

  const proposedByName = nameOf(stake?.proposed_by ?? "");
  const pendingByName = nameOf(stake?.pending_by ?? "");

  return (
    <>
      <StakesSync podId={current.podId} />
      <main className="px-5 pb-28 pt-9">
        <Link
          href={`/app?pod=${current.podId}`}
          className="text-[15px] font-semibold text-muted"
        >
          ← Back
        </Link>
        <h1 className="mb-1 mt-6 font-serif text-[26px] font-semibold leading-tight text-ink">
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
          firstPeriodStart={firstPeriodStart}
          activeView={activeView}
          pendingAction={
            stake?.status === "active" ? stake?.pending_action ?? null : null
          }
          pendingWeeks={stake?.pending_weeks ?? null}
          pendingProposalId={pendingProposalId}
          pendingById={stake?.pending_by ?? null}
          pendingByName={pendingByName}
          offLastSettlement={offLastSettlement}
        />
      </main>
      <BottomNav active="settings" podId={current.podId} userId={user.id} />
    </>
  );
}
