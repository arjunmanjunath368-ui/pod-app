// Day-level helpers for the activity calendar (independent of the weekly streak).

// "YYYY-MM-DD" for a given instant, in the given timezone.
export function dayKeyInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type DayCell = { day: number | null; key: string | null; isToday: boolean };

// Current month as a Sunday-first grid of cells (leading blanks for alignment).
export function monthGrid(
  tz: string,
  ref: Date = new Date()
): { monthLabel: string; cells: DayCell[]; todayKey: string } {
  const todayKey = dayKeyInTz(ref, tz);
  const [yStr, mStr] = todayKey.split("-");
  const year = +yStr;
  const month = +mStr; // 1-12

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" }
  );
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun

  const cells: DayCell[] = [];
  for (let i = 0; i < firstWeekday; i++)
    cells.push({ day: null, key: null, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(
      2,
      "0"
    )}`;
    cells.push({ day: d, key, isToday: key === todayKey });
  }
  return { monthLabel, cells, todayKey };
}
