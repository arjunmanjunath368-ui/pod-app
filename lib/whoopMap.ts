import type { ActivityKey } from "./activities";
import { mapHealthKitWorkout } from "./healthkitMap";

// WHOOP sport names are lowercase and hyphenated ("functional-fitness",
// "weightlifting"). These rules catch the ones the shared keyword mapper would
// miss; everything else falls through to it, and anything unrecognised becomes
// "other" so a workout is never dropped just for its label.
const RULES: { activity: ActivityKey; keys: string[] }[] = [
  {
    activity: "strength",
    keys: [
      "functional fitness",
      "powerlifting",
      "weightlifting",
      "calisthenics",
      "kettlebell",
      "bodyweight",
      "strength",
    ],
  },
  {
    activity: "cardio",
    keys: [
      "stairmaster",
      "stepmaster",
      "stepmill",
      "jumping rope",
      "jump rope",
      "spinning",
      "assault bike",
      "box fitness",
      "aerobic",
    ],
  },
  {
    activity: "sport",
    keys: [
      "snowboard",
      "ski",
      "surf",
      "skat",
      "paddle",
      "kayak",
      "canoe",
      "sail",
      "diving",
      "water polo",
      "ultimate",
      "disc golf",
    ],
  },
  { activity: "mobility", keys: ["mobility", "meditation"] },
  { activity: "steps", keys: ["rucking", "hiking", "walking"] },
];

export function mapWhoopSport(name: string | null | undefined): ActivityKey {
  const n = (name ?? "").toLowerCase().replace(/[-_]+/g, " ").trim();
  for (const rule of RULES) {
    if (rule.keys.some((k) => n.indexOf(k) !== -1)) return rule.activity;
  }
  return mapHealthKitWorkout(n);
}

// Same noise floor as the Apple Health sync: a few minutes of auto-detected
// movement isn't a workout.
export const MIN_WORKOUT_SECONDS = 5 * 60;

export type WhoopWorkoutLike = {
  id?: string;
  start?: string;
  end?: string;
  sport_name?: string;
};

export type SessionFields = {
  externalId: string; // "whoop:<uuid>" — never collides with Apple Health ids
  activity: ActivityKey;
  loggedAt: Date;
  durationSeconds: number;
};

// Deliberately minimal. Per WHOOP's API terms Pod must not build a store of
// WHOOP's data, and WHOOP's own calculations (strain, calories, heart rate,
// recovery) are exactly what they protect — so none of it is read here. A
// Pod log needs only: what kind of workout, when, and for how long.
export function workoutToSessionFields(
  w: WhoopWorkoutLike
): SessionFields | null {
  if (!w || typeof w.id !== "string" || w.id.length === 0) return null;
  if (!w.start || !w.end) return null;
  const start = new Date(w.start);
  const end = new Date(w.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  if (seconds < MIN_WORKOUT_SECONDS) return null;
  return {
    externalId: `whoop:${w.id}`,
    activity: mapWhoopSport(w.sport_name),
    loggedAt: start,
    durationSeconds: seconds,
  };
}
