import type { ActivityKey } from "@/lib/activities";

// HealthKit has 70+ workout type names (Health Auto Export passes them through
// verbatim as `name`, e.g. "Traditional Strength Training", "Running", "Yoga").
// Rather than an exhaustive exact-match table (fragile against Apple adding new
// types), match on keywords and fall back to "other" for anything unrecognized
// — so an unmapped workout still logs, just uncategorized.
const RULES: { keys: string[]; activity: ActivityKey }[] = [
  {
    activity: "strength",
    keys: [
      "strength",
      "weight",
      "lifting",
      "crossfit",
      "cross fit",
      "resistance",
    ],
  },
  {
    activity: "cardio",
    keys: [
      "running",
      "run",
      "cycling",
      "bike",
      "swim",
      "rowing",
      "row",
      "elliptical",
      "stair",
      "cardio",
      "interval",
      "hiit",
      "jump rope",
      "kickbox",
      "boxing",
      "dance",
      "aerobic",
    ],
  },
  {
    activity: "sport",
    keys: [
      "basketball",
      "soccer",
      "football",
      "tennis",
      "golf",
      "hockey",
      "baseball",
      "softball",
      "volleyball",
      "badminton",
      "squash",
      "racquetball",
      "climbing",
      "climb",
      "martial arts",
      "wrestling",
      "handball",
      "cricket",
      "rugby",
      "pickleball",
      "lacrosse",
    ],
  },
  {
    activity: "mobility",
    keys: [
      "yoga",
      "pilates",
      "stretch",
      "flexibility",
      "tai chi",
      "barre",
      "cooldown",
      "mind and body",
    ],
  },
  {
    activity: "steps",
    keys: ["walk", "hik", "step"],
  },
];

export function mapHealthKitWorkout(name: string): ActivityKey {
  const n = (name || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.keys.some((k) => n.includes(k))) return rule.activity;
  }
  return "other";
}
