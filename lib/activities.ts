export type ActivityKey =
  | "strength"
  | "cardio"
  | "sport"
  | "mobility"
  | "steps"
  | "other";

export const ACTIVITIES: { key: ActivityKey; label: string; emoji: string }[] = [
  { key: "strength", label: "Strength", emoji: "🏋️" },
  { key: "cardio", label: "Cardio", emoji: "🫀" },
  { key: "sport", label: "Sport", emoji: "🎾" },
  { key: "mobility", label: "Mobility", emoji: "🧘" },
  { key: "steps", label: "Steps", emoji: "👟" },
  { key: "other", label: "Other", emoji: "✨" },
];

export function activityMeta(key?: string | null) {
  return (
    ACTIVITIES.find((a) => a.key === key) ?? {
      key: "other" as ActivityKey,
      label: "Activity",
      emoji: "✨",
    }
  );
}

// The sport's own name from a synced workout ("pickleball", "padel",
// "functional fitness"), so the feed can say what someone actually did. Null
// when it adds nothing beyond the category or is a generic label.
const GENERIC_SPORT_NAMES = new Set([
  "activity",
  "workout",
  "other",
  "sport",
  "sports",
  "strength",
  "cardio",
  "mobility",
  "steps",
  "unknown",
]);
export function sportLabelFrom(name: string | null | undefined): string | null {
  const n = (name ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!n || n.length > 40 || GENERIC_SPORT_NAMES.has(n)) return null;
  return n;
}
