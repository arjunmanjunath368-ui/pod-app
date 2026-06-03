// Returns the UTC instant of the start of the current week, in the pod's
// timezone (weekStartsOn: 1 = Monday). Library-free; precise enough for
// week-boundary counting. Sessions logged at/after this count toward "this week".
export function weekStartUtc(
  tz: string,
  weekStartsOn = 1,
  ref: Date = new Date()
): Date {
  const offset = tzOffsetMs(ref, tz); // localWall = utc + offset
  const localWall = new Date(ref.getTime() + offset);

  const day = localWall.getUTCDay(); // 0=Sun .. 6=Sat (of pod-local wall clock)
  const diff = (day - weekStartsOn + 7) % 7;

  const startLocalWall = Date.UTC(
    localWall.getUTCFullYear(),
    localWall.getUTCMonth(),
    localWall.getUTCDate() - diff,
    0,
    0,
    0,
    0
  );

  return new Date(startLocalWall - offset);
}

// Days remaining in the current week (1..7), including today, in the pod's tz.
export function daysLeftInWeek(
  tz: string,
  weekStartsOn = 1,
  ref: Date = new Date()
): number {
  const offset = tzOffsetMs(ref, tz);
  const localWall = new Date(ref.getTime() + offset);
  const idx = (localWall.getUTCDay() - weekStartsOn + 7) % 7; // 0-based day in week
  return 7 - idx;
}

function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {} as Record<string, string>);
  const asUTC = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second
  );
  return asUTC - date.getTime();
}
