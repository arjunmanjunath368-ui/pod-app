// Rest days: on a red-recovery day, resting counts as showing up.
//
// How it stays honest and private:
//  - Opt-in only. The member turns on Recovery & sleep in Settings, which asks
//    WHOOP for read:recovery (and read:sleep for the Home rings).
//  - Automatic: when WHOOP scores today's recovery in the red (0 to 33%), Pod
//    logs a rest day for the member. It's checked when WHOOP reports a new
//    recovery (webhook) and again whenever the member opens Home.
//  - The score is never stored and never shown to the pod. All the pod sees is
//    "took a rest day".
//  - A rest day is saved as an unverified log, so it never counts toward
//    stakes, and only REST_DAYS_PER_WEEK of them count toward the weekly goal
//    (enforced here and again in lib/goals.ts).

import { dayKeyInTz } from "./days";
import { weekStartUtc } from "./week";
import { REST_DAYS_PER_WEEK as CAP } from "./goals";

export { REST_DAYS_PER_WEEK } from "./goals";

// WHOOP's recovery zones: red 0 to 33, yellow 34 to 66, green 67 to 100.
export const RED_RECOVERY_MAX = 33;

// A recovery is scored when you wake. Anything older than this belongs to an
// earlier day, so it can't justify resting today.
export const RECOVERY_FRESH_HOURS = 20;

export type RecoveryCheck =
  | "red" // rest counts today
  | "not_red" // yellow or green
  | "calibrating" // WHOOP is still learning this member's baseline
  | "unscored"; // no fresh, scored recovery yet today

// Decide from WHOOP's latest recovery record (GET /v2/recovery?limit=1).
export function assessRecovery(record: any, now: Date = new Date()): RecoveryCheck {
  if (!record || record.score_state !== "SCORED" || !record.score) return "unscored";
  const created = new Date(record.created_at ?? record.updated_at ?? "");
  if (isNaN(created.getTime())) return "unscored";
  const ageH = (now.getTime() - created.getTime()) / 3600000;
  if (ageH < -1 || ageH > RECOVERY_FRESH_HOURS) return "unscored";
  if (record.score.user_calibrating === true) return "calibrating";
  const score = Number(record.score.recovery_score);
  if (!isFinite(score)) return "unscored";
  return score <= RED_RECOVERY_MAX ? "red" : "not_red";
}

// Rest-day logs use a fixed external id per day, so tapping twice (or in two
// tabs) can never create two rest days for the same date.
export function restExternalId(dayKey: string): string {
  return `rest:${dayKey}`;
}

export type AutoRestResult = { logged: number; alreadyActive: number; capped: number };

// Log today's rest day in each active pod where today doesn't already count and
// this week's rest days aren't used up. Idempotent: one rest day per pod per day.
export async function autoLogRestDay(
  svc: any,
  userId: string,
  now: Date = new Date()
): Promise<AutoRestResult> {
  const out: AutoRestResult = { logged: 0, alreadyActive: 0, capped: 0 };
  const { data: mems } = await svc
    .from("pod_members")
    .select("pod_id, joined_at, pods(timezone, week_starts_on)")
    .eq("user_id", userId)
    .eq("status", "active");
  for (const m of (mems ?? []) as any[]) {
    const pod = Array.isArray(m.pods) ? m.pods[0] : m.pods;
    const tz = pod?.timezone ?? "America/Chicago";
    const weekStart = weekStartUtc(tz, pod?.week_starts_on ?? 1, now);
    const todayKey = dayKeyInTz(now, tz);
    const { data: week } = await svc
      .from("sessions")
      .select("logged_at, rest_day")
      .eq("pod_id", m.pod_id)
      .eq("user_id", userId)
      .gte("logged_at", weekStart.toISOString());
    const rows = (week ?? []) as any[];
    if (rows.some((s) => dayKeyInTz(new Date(s.logged_at), tz) === todayKey)) {
      out.alreadyActive++; // an activity (or today's rest day) already counts
      continue;
    }
    if (rows.filter((s) => s.rest_day).length >= CAP) {
      out.capped++;
      continue;
    }
    const { error } = await svc.from("sessions").upsert(
      {
        pod_id: m.pod_id,
        user_id: userId,
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
    if (!error) out.logged++;
  }
  return out;
}
