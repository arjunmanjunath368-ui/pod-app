import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { mapHealthKitWorkout } from "@/lib/healthkitMap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A completed workout shorter than this is almost always an accidental
// auto-detected "workout" (HealthKit sometimes flags a few minutes of brisk
// walking) rather than something the person would call a session.
const MIN_DURATION_SECONDS = 5 * 60;

// Health Auto Export's date format is "yyyy-MM-dd HH:mm:ss Z" (space before
// the offset, e.g. "2026-01-19 10:48:51 +0000"). JS Date silently fails to
// parse that shape — the offset has to be joined with no space — so this
// can't just be a naive replace(" ", "T").
function parseHKDate(raw: string): Date {
  const m = raw
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\s*([+-]\d{4}|Z)?$/);
  if (!m) return new Date(raw); // unrecognized shape: let Date do its best
  const [, date, time, offset] = m;
  return new Date(`${date}T${time}${offset ?? "+0000"}`);
}

type HKWorkout = {
  id?: string;
  name?: string;
  start?: string;
  end?: string;
  duration?: number;
};

// Auto-logs never touch stakes: they always save verified=false, exactly like
// a gallery photo. HealthKit data is user-editable on-device, so it has none
// of the live-capture guarantee stakes verification depends on — that
// invariant must never change here.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 500 });
  }
  const supabase = createServiceClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("health_sync_token", token)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const userId = profile.id as string;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const workouts: HKWorkout[] = Array.isArray(body?.data?.workouts)
    ? body.data.workouts
    : [];
  if (workouts.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0 });
  }

  // Sync into every pod the person is actively part of (paused/left pods are
  // excluded, matching how a manual multi-pod log already behaves).
  const { data: mems } = await supabase
    .from("pod_members")
    .select("pod_id")
    .eq("user_id", userId)
    .eq("status", "active");
  const podIds: string[] = (mems ?? []).map((m: any) => m.pod_id);
  if (podIds.length === 0) {
    return NextResponse.json({ imported: 0, skipped: workouts.length });
  }

  let imported = 0;
  let skipped = 0;
  const rows: {
    pod_id: string;
    user_id: string;
    activity: string;
    activities: string[];
    photo_url: null;
    logged_at: string;
    verified: false;
    voided: false;
    source: "healthkit";
    external_id: string;
  }[] = [];

  for (const w of workouts) {
    const start = w.start ? parseHKDate(w.start) : null;
    const duration =
      typeof w.duration === "number"
        ? w.duration
        : start && w.end
          ? (parseHKDate(w.end).getTime() - start.getTime()) / 1000
          : 0;
    if (!start || isNaN(start.getTime()) || duration < MIN_DURATION_SECONDS) {
      skipped++;
      continue;
    }
    // v2 payloads carry a stable `id`; fall back to a synthesized key (v1 has
    // none) so a re-sent window still de-dupes against what we already have.
    const externalId =
      w.id && w.id.length > 0
        ? w.id
        : `${w.name ?? "workout"}|${start.toISOString()}`;
    const activity = mapHealthKitWorkout(w.name ?? "");

    for (const podId of podIds) {
      rows.push({
        pod_id: podId,
        user_id: userId,
        activity,
        activities: [activity],
        photo_url: null,
        logged_at: start.toISOString(),
        verified: false,
        voided: false,
        source: "healthkit",
        external_id: externalId,
      });
    }
    imported++;
  }

  if (rows.length > 0) {
    // onConflict matches the partial unique index — a re-sent workout for a
    // pod the person is already in is silently skipped, not duplicated.
    await supabase
      .from("sessions")
      .upsert(rows, {
        onConflict: "pod_id,user_id,external_id",
        ignoreDuplicates: true,
      });
  }

  return NextResponse.json({ imported, skipped });
}
