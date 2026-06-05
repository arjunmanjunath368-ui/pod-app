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
