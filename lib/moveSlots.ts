// When a member usually has time to move. Pod nudges them at the start of their
// window on days they haven't been active yet, so nobody has to rely on a
// pod-mate remembering to nudge them.

export type MoveSlot = "early" | "morning" | "midday" | "afternoon" | "evening" | "night";

export const MOVE_SLOTS: { key: MoveSlot; label: string; hours: string; start: number }[] = [
  { key: "early", label: "Early morning", hours: "5–8 am", start: 5 },
  { key: "morning", label: "Morning", hours: "8–11 am", start: 8 },
  { key: "midday", label: "Midday", hours: "11 am–2 pm", start: 11 },
  { key: "afternoon", label: "Afternoon", hours: "2–5 pm", start: 14 },
  { key: "evening", label: "Evening", hours: "5–8 pm", start: 17 },
  { key: "night", label: "Night", hours: "8–11 pm", start: 20 },
];

export function cleanSlots(raw: unknown): MoveSlot[] {
  const keys = MOVE_SLOTS.map((s) => s.key);
  return Array.isArray(raw)
    ? (raw.filter((k) => keys.includes(k as MoveSlot)) as MoveSlot[])
    : [];
}

// Local hour (0-23) in a timezone.
export function localHour(tz: string, now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now)
  ) % 24;
}

// The next window that hasn't started yet today, if any, as "6 pm" etc.
export function nextNudgeLabel(slots: MoveSlot[], tz: string, now: Date = new Date()): string | null {
  const h = localHour(tz, now);
  const starts = MOVE_SLOTS.filter((s) => slots.includes(s.key))
    .map((s) => s.start)
    .sort((a, b) => a - b);
  const next = starts.find((st) => st > h);
  if (next === undefined) return null;
  const hr = next % 12 === 0 ? 12 : next % 12;
  return `${hr} ${next < 12 ? "am" : "pm"}`;
}

// Which window (if any) starts in this local hour.
export function slotStartingAt(slots: MoveSlot[], hour: number): MoveSlot | null {
  const s = MOVE_SLOTS.find((x) => slots.includes(x.key) && x.start === hour);
  return s ? s.key : null;
}
