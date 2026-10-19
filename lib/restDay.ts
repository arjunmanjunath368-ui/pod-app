// Rest days: on a red-recovery day, resting counts as showing up.
//
// How it stays honest and private:
//  - Opt-in only. The member turns it on in Settings, which asks WHOOP for the
//    read:recovery permission on top of workouts.
//  - Recovery is read only when the member taps "Take a rest day", and only to
//    check one thing: is today's score in WHOOP's red zone (0 to 33%)? The
//    score itself is never stored and never shown to the pod. All the pod sees
//    is "took a rest day".
//  - A rest day is saved as an unverified log, so it never counts toward
//    stakes, and only REST_DAYS_PER_WEEK of them count toward the weekly goal
//    (enforced here and again in lib/goals.ts).

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
