import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { computeStakes, periodStartInstant } from "@/lib/stakes";
import { parseGoal } from "@/lib/goals";
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

  // ---- Settle any one-and-done stake whose period has ended, then push the
  // result to the whole pod (so it lands even if nobody opens the app). ----
  const stakes = await settleEndedStakes(supabase);

  return NextResponse.json({
    ok: true,
    bestsMarked: anchorIds.length,
    usersNotified,
    pushesSent,
    autoResumed: resumed,
    stakesSettled: stakes.settled,
    stakePushes: stakes.pushes,
  });
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
      .select("user_id, logged_at, activity, activities, verified")
      .eq("pod_id", st.pod_id)
      .gte("logged_at", startInstant.toISOString());
    const sessions = (sess ?? []).map((s: any) => ({
      userId: s.user_id as string,
      loggedAt: new Date(s.logged_at),
      activity: (s.activity as string | null) ?? null,
      activities: (s.activities as string[] | null) ?? null,
      verified: (s.verified as boolean | null) ?? true,
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
