import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { computeStakes, periodStartInstant, stakeWeekBounds } from "@/lib/stakes";
import { parseGoal, goalHit, goalProgress } from "@/lib/goals";
import { dayKeyInTz } from "@/lib/days";
import { weekStartUtc } from "@/lib/week";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS = 21; // nudge 3 weeks after the last entry for a best

type Row = {
  id: string;
  user_id: string;
  name: string;
  value: number;
  unit: string | null;
  higher_is_better: boolean;
  created_at: string;
  reminded_at: string | null;
};

function configurePush(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@podfitt.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

// Send one message to a single user's devices; prune dead subscriptions.
async function sendToUser(
  supabase: any,
  userId: string,
  title: string,
  body: string,
  url: string
): Promise<number> {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return 0;
  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { urgency: "high" }
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        }
      }
    })
  );
  return sent;
}

export async function GET(req: Request) {
  // Only Vercel Cron (or someone holding the secret) may run this.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!configurePush()) {
    return NextResponse.json({ error: "Push not configured" }, { status: 500 });
  }

  // Manual testing only: when present (and only reachable with the cron
  // secret above), stakeStatusPings treats this one pod's final-stretch check
  // as always due — bypassing the "<=2 days left" and "already warned" gates
  // so a real send can be triggered on demand instead of waiting for the
  // calendar. No effect on any other pod, and no effect at all if omitted.
  const testStakePod = new URL(req.url).searchParams.get("testStakePod");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase service credentials missing" },
      { status: 500 }
    );
  }
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  // Pull bests whose entries are old enough to possibly qualify. We still need
  // every entry per (user,name) to know the record and the latest entry, so we
  // fetch by user/name and reason in code.
  const { data: rows, error } = await supabase
    .from("personal_bests")
    .select(
      "id, user_id, name, value, unit, higher_is_better, created_at, reminded_at"
    )
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by user + name; rows already sorted newest-first.
  const groups = new Map<string, Row[]>();
  for (const r of (rows ?? []) as Row[]) {
    const k = `${r.user_id}::${r.name}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }

  // Per user, collect bests where the LATEST entry is >= 21 days old and we
  // haven't nudged on it yet. (A newer entry would mean they beat/re-logged it,
  // and would itself be the latest with reminded_at NULL.)
  type Eligible = { name: string; record: number; unit: string | null };
  const byUser = new Map<string, Eligible[]>();
  const anchorIds: string[] = [];

  for (const list of Array.from(groups.values())) {
    const anchor = list[0]; // newest entry for this best
    if (anchor.reminded_at) continue;
    if (new Date(anchor.created_at) > cutoff) continue;

    // The current record value across all entries for this name.
    let record = anchor.value;
    for (const r of list) {
      if (anchor.higher_is_better) record = Math.max(record, r.value);
      else record = Math.min(record, r.value);
    }

    const arr = byUser.get(anchor.user_id) ?? [];
    arr.push({ name: anchor.name, record, unit: anchor.unit });
    byUser.set(anchor.user_id, arr);
    anchorIds.push(anchor.id);
  }

  let usersNotified = 0;
  let pushesSent = 0;

  for (const [userId, bests] of Array.from(byUser.entries())) {
    let title: string;
    let body: string;
    if (bests.length === 1) {
      const b = bests[0];
      const valueStr = `${b.record}${b.unit ? ` ${b.unit}` : ""}`;
      title = "🏆 Time to beat your best";
      body = `It's been 3 weeks since your “${b.name}” best (${valueStr}). Ready to push for a new high?`;
    } else {
      title = "🏆 Bests waiting to be beaten";
      body = `You've got ${bests.length} personal bests you haven't topped in a while. Ready to push for a new high?`;
    }
    const sent = await sendToUser(supabase, userId, title, body, "/app/you");
    if (sent > 0) usersNotified++;
    pushesSent += sent;
  }

  // Mark every qualifying best as nudged so it won't fire again for this entry.
  if (anchorIds.length) {
    await supabase
      .from("personal_bests")
      .update({ reminded_at: new Date().toISOString() })
      .in("id", anchorIds);
  }

  // ---- Auto-resume anyone whose pause window has elapsed. Staked pods resume
  // unstaked until the next week boundary, so no one is dropped into a partial
  // staked week. ----
  const resumed = await autoResumeEnded(supabase);

  // ---- Nudge anyone who's gone quiet: a gentle check-in that offers Pause at
  // the moment it's actually useful (this is the drop-off we lose people to). ----
  const absent = await nudgeAbsent(supabase);

  // ---- While a multi-week stake is still running, keep people informed: a
  // recap when a sub-week closes, and a private nudge if they're short with
  // little time left in the current one. Otherwise a 2-6 week stake is silent
  // until the very end. ----
  const digest = await stakeStatusPings(supabase, testStakePod);

  // ---- Settle any one-and-done stake whose period has ended, then push the
  // result to the whole pod (so it lands even if nobody opens the app). ----
  const stakes = await settleEndedStakes(supabase);

  return NextResponse.json({
    ok: true,
    bestsMarked: anchorIds.length,
    usersNotified,
    pushesSent,
    autoResumed: resumed,
    absentNudged: absent,
    stakeWeeklyRecaps: digest.weeklyRecaps,
    stakeFinalStretchWarnings: digest.finalStretch,
    stakesSettled: stakes.settled,
    stakePushes: stakes.pushes,
  });
}

// Someone who's gone quiet gets a check-in — never a scolding, and never a
// broadcast to the pod. The nudge offers Pause explicitly, because the moment
// you're falling off is exactly when Pause is worth knowing about.
//
// Quiet = no logged session in QUIET_DAYS. Paused members are left alone.
// Cooldown stops it repeating daily; the copy escalates gently if they stay away.
async function nudgeAbsent(supabase: any): Promise<number> {
  const QUIET_DAYS = 5; // first check-in
  const LONG_DAYS = 10; // warmer, more direct copy past this
  const COOLDOWN_DAYS = 5; // don't nudge the same person more often than this
  const GRACE_DAYS = 3; // brand-new members get a moment to settle in

  const nowMs = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const { data: members } = await supabase
    .from("pod_members")
    .select("user_id, pod_id, joined_at, absent_nudged_at, pods(name)")
    .eq("status", "active");
  if (!members?.length) return 0;

  const userIds: string[] = [];
  const podIds: string[] = [];
  for (const m of members as any[]) {
    if (!userIds.includes(m.user_id)) userIds.push(m.user_id);
    if (!podIds.includes(m.pod_id)) podIds.push(m.pod_id);
  }

  // Last log per (user, pod).
  const { data: sessions } = await supabase
    .from("sessions")
    .select("user_id, pod_id, logged_at")
    .in("pod_id", podIds)
    .gte("logged_at", new Date(nowMs - 90 * day).toISOString());
  const lastLog: Record<string, number> = {};
  for (const s of (sessions ?? []) as any[]) {
    const k = `${s.user_id}::${s.pod_id}`;
    const t = new Date(s.logged_at).getTime();
    if (!lastLog[k] || t > lastLog[k]) lastLog[k] = t;
  }

  // Pods with money on the line — worth naming in the nudge.
  const { data: stakeRows } = await supabase
    .from("pod_stakes")
    .select("pod_id")
    .eq("status", "active")
    .in("pod_id", podIds);
  const stakedPods: string[] = (stakeRows ?? []).map((r: any) => r.pod_id);

  // One nudge per person, even if they're quiet in several pods.
  type Cand = { podId: string; podName: string; quiet: number; staked: boolean };
  const byUser: Record<string, Cand> = {};
  const touched: { userId: string; podId: string }[] = [];

  for (const m of members as any[]) {
    const joined = m.joined_at ? new Date(m.joined_at).getTime() : nowMs;
    if (nowMs - joined < GRACE_DAYS * day) continue;

    if (m.absent_nudged_at) {
      const since = nowMs - new Date(m.absent_nudged_at).getTime();
      if (since < COOLDOWN_DAYS * day) continue;
    }

    // Never logged? Measure from when they joined.
    const last = lastLog[`${m.user_id}::${m.pod_id}`] ?? joined;
    const quiet = Math.floor((nowMs - last) / day);
    if (quiet < QUIET_DAYS) continue;

    const pod = Array.isArray(m.pods) ? m.pods[0] : m.pods;
    const cand: Cand = {
      podId: m.pod_id,
      podName: pod?.name ?? "your pod",
      quiet,
      staked: stakedPods.includes(m.pod_id),
    };
    // Prefer the pod where they've been quiet longest (staked pods win ties).
    const cur = byUser[m.user_id];
    if (
      !cur ||
      cand.quiet > cur.quiet ||
      (cand.quiet === cur.quiet && cand.staked && !cur.staked)
    ) {
      byUser[m.user_id] = cand;
    }
    touched.push({ userId: m.user_id, podId: m.pod_id });
  }

  let nudged = 0;
  for (const userId of Object.keys(byUser)) {
    const c = byUser[userId];
    const long = c.quiet >= LONG_DAYS;

    const title = long ? "Still with us?" : "Everything alright?";
    let body: string;
    if (long) {
      body = `It's been ${c.quiet} days since your last workout in ${c.podName}. If life's busy, pause your week — it won't count against you. Otherwise, one log gets you back in.`;
    } else {
      body = `No workouts logged in ${c.podName} for ${c.quiet} days. Jump back in — or pause the week if you're travelling.`;
    }
    if (c.staked && !long) {
      body = `No workouts logged in ${c.podName} for ${c.quiet} days — and there's a stake running. Log one, or pause the week if you're away.`;
    }

    const sent = await sendToUser(supabase, userId, title, body, "/app");
    if (sent > 0) nudged++;
  }

  // Mark everyone we considered, so the cooldown holds even if push failed
  // (no subscription) — otherwise we'd retry them every single day.
  const stamp = new Date().toISOString();
  for (const t of touched) {
    await supabase
      .from("pod_members")
      .update({ absent_nudged_at: stamp })
      .eq("user_id", t.userId)
      .eq("pod_id", t.podId);
  }

  return nudged;
}

async function autoResumeEnded(supabase: any): Promise<number> {
  const now = new Date();
  const { data: paused } = await supabase
    .from("pod_members")
    .select("user_id, pod_id, pause_until, pods(timezone, week_starts_on)")
    .eq("status", "paused")
    .not("pause_until", "is", null);
  if (!paused?.length) return 0;

  // Which of these pods currently have stakes running.
  const podIds = Array.from(new Set(paused.map((m: any) => m.pod_id)));
  const { data: stakeRows } = await supabase
    .from("pod_stakes")
    .select("pod_id")
    .in("pod_id", podIds)
    .eq("status", "active");
  const stakedPods = new Set((stakeRows ?? []).map((s: any) => s.pod_id));

  let resumed = 0;
  for (const m of paused as any[]) {
    const pod = Array.isArray(m.pods) ? m.pods[0] : m.pods;
    const tz = pod?.timezone ?? "UTC";
    const wso = pod?.week_starts_on ?? 1;
    // Past or equal to the pod's "today" means the pause window has elapsed.
    if (String(m.pause_until).slice(0, 10) > dayKeyInTz(now, tz)) continue;

    // Staked pods: don't stake them on the partial current week — pick them up
    // from the next week boundary (matches the manual "staked from Monday").
    let stakedFrom: string | null = null;
    if (stakedPods.has(m.pod_id)) {
      const ws = weekStartUtc(tz, wso);
      stakedFrom = dayKeyInTz(
        new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000),
        tz
      );
    }

    const { error } = await supabase
      .from("pod_members")
      .update({ status: "active", pause_until: null, staked_from: stakedFrom })
      .eq("pod_id", m.pod_id)
      .eq("user_id", m.user_id);
    if (!error) resumed++;
  }
  return resumed;
}

function money(n: number): string {
  const sign = n >= 0 ? "+$" : "−$";
  const abs = Math.abs(n);
  const str = Number.isInteger(abs) ? String(abs) : abs.toFixed(2);
  return `${sign}${str}`;
}

// A 2-6 week stake period currently only speaks up once, at the very end
// (settleEndedStakes). This fills the silence in between with two throttled
// events per pod, each firing at most once no matter how often the cron runs:
//
//   (a) Weekly recap — a sub-week inside the period just closed. Push each
//       member that week's net plus the running total for the period so far.
//   (b) Final-stretch warning — 2 or fewer days left in the CURRENT week and
//       a member hasn't hit their goal yet. Private nudge, sent once per week.
async function stakeStatusPings(
  supabase: any,
  testPodId?: string | null
): Promise<{ weeklyRecaps: number; finalStretch: number }> {
  const now = new Date();
  let weeklyRecaps = 0;
  let finalStretch = 0;

  const { data: active } = await supabase
    .from("pod_stakes")
    .select(
      "pod_id, stake_amount, period_start, period_weeks, status, last_week_notified, warned_week_key"
    )
    .eq("status", "active")
    .not("period_start", "is", null);

  for (const st of active ?? []) {
    const { data: pod } = await supabase
      .from("pods")
      .select("name, timezone, week_starts_on")
      .eq("id", st.pod_id)
      .maybeSingle();
    const tz = pod?.timezone ?? "UTC";
    const wso = pod?.week_starts_on ?? 1;
    const podName = pod?.name ?? "your pod";

    const { data: mems } = await supabase
      .from("pod_members")
      .select(
        "user_id, status, goal_activity, goal_target_per_week, goal_mode, goal_activities, goal_splits, staked_from, profiles(display_name)"
      )
      .eq("pod_id", st.pod_id)
      .neq("status", "left");
    if (!mems?.length) continue;

    const members: {
      userId: string;
      target: number;
      status: string;
      stakedFrom: string | null;
      mode: "combined" | "split";
      splits: { activity: string; target: number }[];
    }[] = mems.map((m: any) => {
      const g = parseGoal(m);
      return {
        userId: m.user_id as string,
        target: g.target,
        status: m.status as string,
        stakedFrom: (m.staked_from as string | null) ?? null,
        mode: g.mode,
        splits: g.splits,
      };
    });
    const goalOf: Record<string, ReturnType<typeof parseGoal>> = {};
    mems.forEach((m: any) => (goalOf[m.user_id] = parseGoal(m)));
    const nameOf = (id: string): string => {
      const m = mems.find((x: any) => x.user_id === id);
      const p = m
        ? Array.isArray(m.profiles)
          ? m.profiles[0]
          : m.profiles
        : null;
      return p?.display_name ?? "Member";
    };

    const startInstant = periodStartInstant(st.period_start, tz, wso);
    const { data: sess } = await supabase
      .from("sessions")
      .select("user_id, logged_at, activity, activities, verified, voided")
      .eq("pod_id", st.pod_id)
      .gte("logged_at", startInstant.toISOString());
    const rawSessions = (sess ?? []).filter(
      (s: any) => (s.verified ?? true) !== false && !s.voided
    );
    const sessions = rawSessions.map((s: any) => ({
      userId: s.user_id as string,
      loggedAt: new Date(s.logged_at),
      activity: (s.activity as string | null) ?? null,
      activities: (s.activities as string[] | null) ?? null,
    }));

    const { data: wpRows } = await supabase
      .from("stake_week_participants")
      .select("week_start, user_id")
      .eq("pod_id", st.pod_id)
      .gte("week_start", st.period_start);
    const weekRosters: Record<string, string[]> = {};
    (wpRows ?? []).forEach((r: any) => {
      (weekRosters[r.week_start] ??= []).push(r.user_id as string);
    });

    const baseArgs = {
      stakeAmount: st.stake_amount,
      periodStartDate: st.period_start,
      periodWeeks: st.period_weeks,
      tz,
      weekStartsOn: wso,
      members,
      sessions,
      weekRosters,
    };

    const res = computeStakes({ ...baseArgs, now });
    if (res.isOver) continue; // settleEndedStakes owns the period-end push

    const patch: Record<string, any> = {};

    // ---- (a) A sub-week just closed ----
    if (res.weeksCompleted > (st.last_week_notified ?? 0)) {
      const closedIdx = res.weeksCompleted - 1;
      // Re-run with `now` pinned to that week's own start: at that instant the
      // week is still "in progress," so firmNet only reflects weeks BEFORE it —
      // subtracting gives that one week's net in isolation.
      const { start: closedStart } = stakeWeekBounds(
        tz,
        wso,
        startInstant,
        closedIdx
      );
      const resPrev = computeStakes({ ...baseArgs, now: closedStart });
      const prevNet: Record<string, number> = {};
      resPrev.standings.forEach((s) => (prevNet[s.userId] = s.firmNet));

      const weekNet: { userId: string; net: number }[] = res.standings.map(
        (s) => ({ userId: s.userId, net: s.firmNet - (prevNet[s.userId] ?? 0) })
      );
      // Only worth a push if that week's pot actually moved (someone missed).
      const moved = weekNet.some((w) => Math.abs(w.net) > 0.001);
      if (moved) {
        const orderedWeek = [...weekNet].sort((a, b) => b.net - a.net);
        const orderedTotal = [...res.standings].sort(
          (a, b) => b.firmNet - a.firmNet
        );
        const title = `Week ${res.weeksCompleted} of ${st.period_weeks} settled`;
        const weeksLeft = st.period_weeks - res.weeksCompleted;
        for (const uid of Array.from(
          new Set(weekNet.map((w) => w.userId))
        )) {
          const weekLine = orderedWeek
            .map(
              (w) =>
                `${w.userId === uid ? "You" : nameOf(w.userId)} ${money(w.net)}`
            )
            .join(" · ");
          const totalMine =
            orderedTotal.find((t) => t.userId === uid)?.firmNet ?? 0;
          const tail =
            weeksLeft > 0
              ? ` Running total: ${money(totalMine)}, ${weeksLeft} week${
                  weeksLeft === 1 ? "" : "s"
                } left in ${podName}.`
              : ` Running total: ${money(totalMine)} in ${podName}.`;
          const body = weekLine + "." + tail;
          weeklyRecaps += await sendToUser(
            supabase,
            uid,
            title,
            body,
            `/app/stakes?pod=${st.pod_id}`
          );
        }
      }
      patch.last_week_notified = res.weeksCompleted;
    }

    // ---- (b) Final stretch of the CURRENT week ----
    const isTestPod = !!testPodId && testPodId === st.pod_id;
    if (
      res.currentWeekIndex !== null &&
      res.currentWeekStartKey &&
      (isTestPod || res.currentWeekStartKey !== st.warned_week_key)
    ) {
      const { end } = stakeWeekBounds(tz, wso, startInstant, res.currentWeekIndex);
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
      // Real days-left is calendar-fixed and can't be manufactured via SQL —
      // the test bypass skips the "<=2 days" gate rather than faking the
      // number, so the push shows the true count (e.g. "6 days left") even
      // while testing. That's expected; only the trigger condition is bypassed.
      if (isTestPod || (daysLeft > 0 && daysLeft <= 2)) {
        const weekKey = res.currentWeekStartKey;
        const roster = members.filter(
          (m) =>
            m.status === "active" &&
            m.target >= 1 &&
            (!m.stakedFrom || m.stakedFrom <= weekKey)
        );
        const { start } = stakeWeekBounds(
          tz,
          wso,
          startInstant,
          res.currentWeekIndex
        );
        for (const m of roster) {
          const mine = rawSessions
            .filter(
              (s: any) =>
                s.user_id === m.userId &&
                new Date(s.logged_at).getTime() >= start.getTime() &&
                new Date(s.logged_at).getTime() < end.getTime()
            )
            .map((s: any) => ({
              activity: (s.activity as string | null) ?? null,
              activities: (s.activities as string[] | null) ?? null,
            }));
          const goal = goalOf[m.userId];
          if (goalHit(goal, mine)) continue;
          const { done, target } = goalProgress(goal, mine);
          const short = Math.max(target - done, 0);
          if (short <= 0) continue;
          const title = `⏳ ${daysLeft} day${daysLeft === 1 ? "" : "s"} left this stake week`;
          const body = `You're ${short} ${
            short === 1 ? "session" : "sessions"
          } short of your goal in ${podName} — log one to stay in the money.`;
          finalStretch += await sendToUser(
            supabase,
            m.userId,
            title,
            body,
            `/app/stakes?pod=${st.pod_id}`
          );
        }
        // Only latch the real throttle when the genuine condition held — a
        // test-only run (isTestPod bypassing daysLeft) must never suppress
        // the real warning from firing later this week when it's actually due.
        if (daysLeft > 0 && daysLeft <= 2) {
          patch.warned_week_key = weekKey;
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      await supabase.from("pod_stakes").update(patch).eq("pod_id", st.pod_id);
    }
  }

  return { weeklyRecaps, finalStretch };
}

async function settleEndedStakes(
  supabase: any
): Promise<{ settled: number; pushes: number }> {
  const now = new Date();
  let settled = 0;
  let pushes = 0;

  const { data: active } = await supabase
    .from("pod_stakes")
    .select("pod_id, stake_amount, period_start, period_weeks, status")
    .eq("status", "active")
    .not("period_start", "is", null);

  for (const st of active ?? []) {
    const { data: pod } = await supabase
      .from("pods")
      .select("name, timezone, week_starts_on")
      .eq("id", st.pod_id)
      .maybeSingle();
    const tz = pod?.timezone ?? "UTC";
    const wso = pod?.week_starts_on ?? 1;

    const { data: mems } = await supabase
      .from("pod_members")
      .select(
        "user_id, status, goal_activity, goal_target_per_week, goal_mode, goal_activities, goal_splits, staked_from, profiles(display_name)"
      )
      .eq("pod_id", st.pod_id)
      .neq("status", "left");
    const members = (mems ?? []).map((m: any) => {
      const g = parseGoal(m);
      return {
        userId: m.user_id as string,
        target: g.target,
        status: m.status as string,
        stakedFrom: (m.staked_from as string | null) ?? null,
        mode: g.mode,
        splits: g.splits,
      };
    });
    const nameOf = (id: string): string => {
      const m = (mems ?? []).find((x: any) => x.user_id === id);
      const p = m
        ? Array.isArray(m.profiles)
          ? m.profiles[0]
          : m.profiles
        : null;
      return p?.display_name ?? "Member";
    };

    const startInstant = periodStartInstant(st.period_start, tz, wso);
    const { data: sess } = await supabase
      .from("sessions")
      .select("user_id, logged_at, activity, activities, verified, voided")
      .eq("pod_id", st.pod_id)
      .gte("logged_at", startInstant.toISOString());
    const sessions = (sess ?? []).map((s: any) => ({
      userId: s.user_id as string,
      loggedAt: new Date(s.logged_at),
      activity: (s.activity as string | null) ?? null,
      activities: (s.activities as string[] | null) ?? null,
      verified: (s.verified as boolean | null) ?? true,
      voided: (s.voided as boolean | null) ?? false,
    }));

    const { data: wpRows } = await supabase
      .from("stake_week_participants")
      .select("week_start, user_id")
      .eq("pod_id", st.pod_id)
      .gte("week_start", st.period_start);
    const weekRosters: Record<string, string[]> = {};
    (wpRows ?? []).forEach((r: any) => {
      (weekRosters[r.week_start] ??= []).push(r.user_id as string);
    });

    const res = computeStakes({
      stakeAmount: st.stake_amount,
      periodStartDate: st.period_start,
      periodWeeks: st.period_weeks,
      tz,
      weekStartsOn: wso,
      members,
      sessions,
      weekRosters,
      now,
    });
    if (!res.isOver) continue; // period hasn't fully elapsed yet

    const periodEndDate = dayKeyInTz(res.periodEndInstant, tz);
    const results = res.standings.map((s) => ({
      userId: s.userId,
      net: s.firmNet,
    }));

    // Insert the settlement (unique on pod_id+period_start). If it already
    // exists we still close the stake, but we don't push twice.
    const { error: insErr } = await supabase
      .from("stake_settlements")
      .insert({
        pod_id: st.pod_id,
        period_start: st.period_start,
        period_end: periodEndDate,
        results,
      });

    await supabase
      .from("pod_stakes")
      .update({
        status: "off",
        period_start: null,
        updated_at: now.toISOString(),
      })
      .eq("pod_id", st.pod_id);

    if (insErr) continue; // already settled → no double notification
    settled++;

    // Push everyone's net to each pod member (their own row shown as "You").
    const ordered = [...results].sort((a, b) => b.net - a.net);
    const recipients = (mems ?? []).map((m: any) => m.user_id as string);
    const title = `🏆 Your ${st.period_weeks}-week stake wrapped`;
    for (const uid of recipients) {
      const line = ordered
        .map(
          (r) => `${r.userId === uid ? "You" : nameOf(r.userId)} ${money(r.net)}`
        )
        .join(" · ");
      const body = line || "The stake is settled.";
      pushes += await sendToUser(
        supabase,
        uid,
        title,
        body,
        `/app/stakes?pod=${st.pod_id}`
      );
    }
  }

  return { settled, pushes };
}
