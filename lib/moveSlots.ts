// When a member wants Pod to nudge them. On a day they haven't been active
// yet, Pod sends one nudge at the first of their times, so nobody has to rely
// on a pod-mate remembering to nudge them.
//
// Stored in profiles.move_slots as a list of tokens:
//  - a window from onboarding ("evening"), which means its start hour, or
//  - an exact hour ("h18" = 6 pm), set from Home or Settings.

export type MoveSlot = "early" | "morning" | "midday" | "afternoon" | "evening" | "night";

export const MOVE_SLOTS: { key: MoveSlot; label: string; hours: string; start: number }[] = [
  { key: "early", label: "Early morning", hours: "5–8 am", start: 5 },
  { key: "morning", label: "Morning", hours: "8–11 am", start: 8 },
  { key: "midday", label: "Midday", hours: "11 am–2 pm", start: 11 },
  { key: "afternoon", label: "Afternoon", hours: "2–5 pm", start: 14 },
  { key: "evening", label: "Evening", hours: "5–8 pm", start: 17 },
  { key: "night", label: "Night", hours: "8–11 pm", start: 20 },
];

// The hours offered when picking an exact nudge time.
export const NUDGE_HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 5 am .. 10 pm

const WINDOW_KEYS = MOVE_SLOTS.map((s) => s.key) as string[];

export function hourToken(h: number): string {
  return `h${h}`;
}

// Keep only tokens Pod understands.
export function cleanSlots(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is string => {
    if (typeof k !== "string") return false;
    if (WINDOW_KEYS.includes(k)) return true;
    const m = /^h(\d{1,2})$/.exec(k);
    return !!m && Number(m[1]) >= 0 && Number(m[1]) <= 23;
  });
}

// The nudge hours (0-23, sorted) a list of tokens stands for.
export function slotHours(raw: unknown): number[] {
  const hours = new Set<number>();
  for (const k of cleanSlots(raw)) {
    const w = MOVE_SLOTS.find((s) => s.key === k);
    if (w) hours.add(w.start);
    else hours.add(Number(k.slice(1)));
  }
  return Array.from(hours).sort((a, b) => a - b);
}

export function formatHour(h: number): string {
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${h < 12 ? "am" : "pm"}`;
}

// Local hour (0-23) in a timezone.
export function localHour(tz: string, now: Date = new Date()): number {
  return (
    Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now)) % 24
  );
}

// The next nudge: later today, or tomorrow's first. Null when there are no times.
export function nextNudge(
  raw: unknown,
  tz: string,
  now: Date = new Date()
): { hour: number; today: boolean; text: string } | null {
  const hours = slotHours(raw);
  if (!hours.length) return null;
  const h = localHour(tz, now);
  const later = hours.find((x) => x > h);
  if (later !== undefined) return { hour: later, today: true, text: `at ${formatHour(later)}` };
  return { hour: hours[0], today: false, text: `tomorrow at ${formatHour(hours[0])}` };
}

// The next nudge later today, as "6 pm", or null.
export function nextNudgeLabel(raw: unknown, tz: string, now: Date = new Date()): string | null {
  const n = nextNudge(raw, tz, now);
  return n && n.today ? formatHour(n.hour) : null;
}

// Whether one of the member's nudge times is this local hour.
export function slotStartingAt(raw: unknown, hour: number): boolean {
  return slotHours(raw).includes(hour);
}
