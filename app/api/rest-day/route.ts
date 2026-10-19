import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { whoopCall, whoopConfig } from "@/lib/whoop";
import { buildDeps, getServiceClient } from "@/lib/whoopStore";
import { assessRecovery, restExternalId, REST_DAYS_PER_WEEK } from "@/lib/restDay";
import { dayKeyInTz } from "@/lib/days";
import { weekStartUtc } from "@/lib/week";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Outcome =
  | "logged" // rest day saved in at least one pod
  | "already_active" // today already counts everywhere
  | "cap" // rest days for this week are used up everywhere
  | "not_red"
  | "calibrating"
  | "unscored"
  | "off" // rest days aren't turned on
  | "reconnect" // WHOOP connection needs attention
  | "error";

const json = (status: Outcome, extra: Record<string, unknown> = {}, code = 200) =>
  NextResponse.json({ status, ...extra }, { status: code });

// POST: check today's WHOOP recovery and, if it's red, log a rest day in each
// of the member's active pods. The recovery score is read, compared, and
// dropped: nothing about it is stored.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json("error", {}, 401);

  const svc = getServiceClient();
  const cfg = whoopConfig();
  if (!svc || !cfg) return json("error", {}, 503);

  const { data: prof } = await svc
    .from("profiles")
    .select("rest_days_on")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.rest_days_on) return json("off");

  const { data: conn } = await svc
    .from("whoop_connections")
    .select("scopes")
    .eq("user_id", user.id)
    .maybeSingle();
  const scopes = String(conn?.scopes ?? "");
  if (!conn || (scopes && scopes.split(" ").indexOf("read:recovery") === -1)) {
    return json("reconnect");
  }

  const r = await whoopCall(buildDeps(svc, cfg), user.id, "GET", "/v2/recovery?limit=1");
  if (!r) return json("reconnect");
  if (r.status === 401 || r.status === 403) return json("reconnect");
  if (r.status !== 200) return json("error", {}, 502);
  const latest = Array.isArray(r.json?.records) ? r.json.records[0] : null;
  const check = assessRecovery(latest);
  if (check !== "red") return json(check);

  // Red: log the rest day in every active pod where today doesn't already
  // count and this week's rest days aren't used up.
  const { data: mems } = await svc
    .from("pod_members")
    .select("pod_id, pods(timezone, week_starts_on)")
    .eq("user_id", user.id)
    .eq("status", "active");
  const now = new Date();
  let logged = 0;
  let alreadyActive = 0;
  let capped = 0;
  for (const m of (mems ?? []) as any[]) {
    const pod = Array.isArray(m.pods) ? m.pods[0] : m.pods;
    const tz = pod?.timezone ?? "America/Chicago";
    const weekStart = weekStartUtc(tz, pod?.week_starts_on ?? 1, now);
    const todayKey = dayKeyInTz(now, tz);
    const { data: week } = await svc
      .from("sessions")
      .select("logged_at, rest_day")
      .eq("pod_id", m.pod_id)
      .eq("user_id", user.id)
      .gte("logged_at", weekStart.toISOString());
    const rows = (week ?? []) as any[];
    const today = rows.filter((s) => dayKeyInTz(new Date(s.logged_at), tz) === todayKey);
    if (today.length > 0) {
      alreadyActive++; // an activity or a rest day already counts today
      continue;
    }
    if (rows.filter((s) => s.rest_day).length >= REST_DAYS_PER_WEEK) {
      capped++;
      continue;
    }
    const { error } = await svc.from("sessions").upsert(
      {
        pod_id: m.pod_id,
        user_id: user.id,
        activity: "other",
        activities: ["other"],
        photo_url: null,
        logged_at: now.toISOString(),
        verified: false, // never counts toward stakes
        voided: false,
        source: "whoop",
        external_id: restExternalId(todayKey),
        rest_day: true,
      },
      { onConflict: "pod_id,user_id,external_id", ignoreDuplicates: true }
    );
    if (!error) logged++;
  }

  if (logged > 0) return json("logged", { pods: logged });
  if (capped > 0 && alreadyActive === 0) return json("cap", { perWeek: REST_DAYS_PER_WEEK });
  if (alreadyActive > 0) return json("already_active");
  return json("error", {}, 500);
}

// DELETE: undo today's rest day (in every pod it was logged to).
export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json("error", {}, 401);
  const svc = getServiceClient();
  if (!svc) return json("error", {}, 503);

  const { data: rows } = await svc
    .from("sessions")
    .select("id, logged_at, pod_id")
    .eq("user_id", user.id)
    .eq("rest_day", true)
    .gte("logged_at", new Date(Date.now() - 36 * 3600000).toISOString());
  const podIds = Array.from(new Set(((rows ?? []) as any[]).map((s) => s.pod_id)));
  const tzOf: Record<string, string> = {};
  if (podIds.length) {
    const { data: pods } = await svc.from("pods").select("id, timezone").in("id", podIds);
    ((pods ?? []) as any[]).forEach((p) => (tzOf[p.id] = p.timezone ?? "America/Chicago"));
  }
  const now = new Date();
  const ids = ((rows ?? []) as any[])
    .filter((s) => {
      const tz = tzOf[s.pod_id] ?? "America/Chicago";
      return dayKeyInTz(new Date(s.logged_at), tz) === dayKeyInTz(now, tz);
    })
    .map((s) => s.id);
  if (ids.length) await svc.from("sessions").delete().in("id", ids);
  return NextResponse.json({ status: "undone", removed: ids.length });
}

// PATCH {on}: switch rest days off, or back on when WHOOP already granted
// recovery access. Turning them on for the first time goes through WHOOP's
// own permission screen instead (/api/whoop/connect?consent=1&rest=1).
export async function PATCH(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  let on = false;
  try {
    on = !!(await req.json())?.on;
  } catch {
    /* default: off */
  }
  if (on) {
    const { data: conn } = await svc
      .from("whoop_connections")
      .select("scopes")
      .eq("user_id", user.id)
      .maybeSingle();
    const scopes = String(conn?.scopes ?? "");
    if (!conn || !scopes || scopes.split(" ").indexOf("read:recovery") === -1) {
      return NextResponse.json({ status: "needs_permission" });
    }
  }
  await svc.from("profiles").update({ rest_days_on: on }).eq("id", user.id);
  return NextResponse.json({ status: on ? "on" : "off" });
}
