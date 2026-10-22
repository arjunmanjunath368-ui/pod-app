import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dayKeyInTz } from "@/lib/days";
import { cleanSlots, localHour, slotStartingAt } from "@/lib/moveSlots";
import { pushToUsers } from "@/lib/pushServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Runs every hour (scheduled from Supabase, see sql/pod_slot_nudges_schedule.sql).
// For each member whose usual move window starts this hour in their own time
// zone: if they haven't been active today, one nudge, at most once a day. The
// message leans on who in their pod has already shown up today.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
  const svc = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: profiles, error } = await svc
    .from("profiles")
    .select("id, display_name, move_slots, timezone, slot_nudged_on")
    .not("move_slots", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  let considered = 0;
  let sent = 0;

  for (const p of (profiles ?? []) as any[]) {
    const slots = cleanSlots(p.move_slots);
    if (!slots.length) continue;
    const tz = p.timezone || "America/New_York";
    let hour: number;
    let todayKey: string;
    try {
      hour = localHour(tz, now);
      todayKey = dayKeyInTz(now, tz);
    } catch {
      continue; // bad timezone string
    }
    if (!slotStartingAt(slots, hour)) continue;
    if (p.slot_nudged_on === todayKey) continue;
    considered++;

    // Their active pods.
    const { data: mems } = await svc
      .from("pod_members")
      .select("pod_id, pods(name)")
      .eq("user_id", p.id)
      .eq("status", "active");
    const pods = ((mems ?? []) as any[]).map((m) => ({
      id: m.pod_id as string,
      name: ((Array.isArray(m.pods) ? m.pods[0] : m.pods)?.name ?? "your pod") as string,
    }));
    if (!pods.length) continue;

    // Today's activity in those pods (theirs and pod-mates').
    const since = new Date(now.getTime() - 30 * 3600000).toISOString();
    const { data: recent } = await svc
      .from("sessions")
      .select("user_id, pod_id, logged_at")
      .in(
        "pod_id",
        pods.map((x) => x.id)
      )
      .gte("logged_at", since);
    const today = ((recent ?? []) as any[]).filter(
      (s) => dayKeyInTz(new Date(s.logged_at), tz) === todayKey
    );
    if (today.some((s) => s.user_id === p.id)) {
      await svc.from("profiles").update({ slot_nudged_on: todayKey }).eq("id", p.id);
      continue; // already showed up today
    }

    const mateIds = Array.from(new Set(today.map((s) => s.user_id as string)));
    let names: string[] = [];
    if (mateIds.length) {
      const { data: mates } = await svc
        .from("profiles")
        .select("id, display_name")
        .in("id", mateIds);
      names = ((mates ?? []) as any[]).map((m) =>
        String(m.display_name ?? "Someone").split(/\s+/)[0]
      );
    }
    // One pod: name it. Several: talk about "your pods", never one at random.
    const title = pods.length === 1 ? pods[0].name : "Pod";
    const where = pods.length === 1 ? pods[0].name : "your pods";
    const body =
      names.length >= 2
        ? `${names[0]} and ${names.length - 1 === 1 ? names[1] : `${names.length - 1} others`} already showed up today. Your window's open, so make it count.`
        : names.length === 1
          ? `${names[0]} already showed up today. Your window's open, so make it count.`
          : `Your usual window is open. Be the first in ${where} to show up today.`;

    sent += await pushToUsers(svc, [p.id], title, body, "/app");
    await svc.from("profiles").update({ slot_nudged_on: todayKey }).eq("id", p.id);
  }

  return NextResponse.json({ ok: true, considered, sent });
}
