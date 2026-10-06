import type { WeekOutcome } from "./stakes";

// A pod can put a meal on the line instead of cash: miss your weekly goal and
// you owe the pod one meal. Nothing is paid in the app — Pod keeps the tab, and
// the pod settles by actually meeting up (or a virtual coffee, for pods that
// don't live near each other).
//
// This module holds only the meal-specific rules. WHO hit their goal each week
// still comes from the cash engine (computeStakes → weeks), so both
// consequences always agree on who missed.

export type MealUnit = "dinner" | "lunch" | "coffee" | "round";

export const MEAL_UNITS: {
  key: MealUnit;
  label: string;
  emoji: string;
  noun: string;
  plural: string;
}[] = [
  { key: "dinner", label: "Dinner", emoji: "🍽️", noun: "dinner", plural: "dinners" },
  { key: "lunch", label: "Lunch", emoji: "🥪", noun: "lunch", plural: "lunches" },
  { key: "coffee", label: "Coffee", emoji: "☕", noun: "coffee", plural: "coffees" },
  {
    key: "round",
    label: "Round of drinks",
    emoji: "🍻",
    noun: "round of drinks",
    plural: "rounds of drinks",
  },
];

export function normalizeUnit(u: string | null | undefined): MealUnit {
  const hit = MEAL_UNITS.filter((m) => m.key === u)[0];
  return hit ? hit.key : "dinner";
}

function unitInfo(u: string | null | undefined) {
  const key = normalizeUnit(u);
  return MEAL_UNITS.filter((m) => m.key === key)[0];
}

export function unitEmoji(u: string | null | undefined): string {
  return unitInfo(u).emoji;
}

// "a dinner" / "2 dinners" / "a round of drinks" / "3 lunches"
export function unitPhrase(u: string | null | undefined, n: number): string {
  const info = unitInfo(u);
  if (n === 1) return `a ${info.noun}`;
  return `${n} ${info.plural}`;
}

// Per member: how many meals they owe from COMPLETED weeks (locked in), and
// whether the in-progress week would add one if it ended right now.
//
// A week only moves a tab when at least one person hit AND at least one missed
// — the same rule the cash pot uses. If everyone hit, nobody owes; if everyone
// missed, there's nobody to treat, so nobody owes either.
export function mealTabs(weeks: WeekOutcome[]): {
  locked: Record<string, number>;
  atRisk: Record<string, boolean>;
} {
  const locked: Record<string, number> = {};
  const atRisk: Record<string, boolean> = {};
  for (const w of weeks) {
    const moved = w.hitters.length > 0 && w.hitters.length < w.roster.length;
    if (!moved) continue;
    for (const id of w.roster) {
      if (w.hitters.indexOf(id) !== -1) continue;
      if (w.complete) locked[id] = (locked[id] ?? 0) + 1;
      else atRisk[id] = true;
    }
  }
  return { locked, atRisk };
}

// ---------- Open tabs: what's still owed after a period has settled ----------

export type OpenTab = {
  periodStart: string; // YYYY-MM-DD — together with the debtor, identifies the tab
  periodEnd: string;
  userId: string; // who owes
  owes: number;
  unit: MealUnit;
};

const day = (d: unknown) => String(d ?? "").slice(0, 10);

// Meal pods store `owes` (and `unit`) on each settlement result row; cash
// settlements don't, so they're ignored here. A tab disappears once a pod-mate
// has marked it settled.
export function openTabsFrom(
  settlements: { period_start: unknown; period_end: unknown; results: unknown }[],
  settledRows: { period_start: unknown; user_id: string }[]
): OpenTab[] {
  const settled: Record<string, boolean> = {};
  for (const r of settledRows) settled[`${day(r.period_start)}|${r.user_id}`] = true;

  const out: OpenTab[] = [];
  for (const st of settlements) {
    const results = Array.isArray(st.results) ? (st.results as any[]) : [];
    for (const r of results) {
      const owes = Number(r?.owes);
      if (!isFinite(owes) || owes <= 0 || !r?.userId) continue;
      if (settled[`${day(st.period_start)}|${r.userId}`]) continue;
      out.push({
        periodStart: day(st.period_start),
        periodEnd: day(st.period_end),
        userId: String(r.userId),
        owes,
        unit: normalizeUnit(r.unit),
      });
    }
  }
  return out;
}

// ---------- Notification wording (used by the cron) ----------

// "You owe the pod a dinner · Sam owes the pod 2 dinners" — the viewer's own
// row reads "You owe", everyone else's "<name> owes".
export function tabLine(
  entries: { userId: string; owes: number }[],
  viewerId: string,
  nameOf: (id: string) => string,
  unit: string | null | undefined
): string {
  // Biggest tab first; ties by name so the wording is the same for everyone
  // regardless of who happened to miss first.
  const owing = entries
    .filter((e) => e.owes > 0)
    .sort(
      (a, b) =>
        b.owes - a.owes || nameOf(a.userId).localeCompare(nameOf(b.userId))
    );
  if (owing.length === 0) {
    return "Everyone hit their goals — nobody owes anything.";
  }
  return owing
    .map((e) => {
      const who = e.userId === viewerId ? "You owe" : `${nameOf(e.userId)} owes`;
      return `${who} the pod ${unitPhrase(unit, e.owes)}`;
    })
    .join(" · ");
}
