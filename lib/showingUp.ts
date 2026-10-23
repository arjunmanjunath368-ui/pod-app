// Showing Up Score: how consistently someone hits their own weekly goal.
//
// WHOOP measures how hard you went and how well you recovered. This measures
// whether you showed up. Over the last 8 finished weeks: the days you showed
// up (counting each week only up to its goal, rest days included) out of the
// days you aimed for. 28 of 32 goal days = 88.

export const SCORE_WEEKS = 8;

export type ScoreWeek = { done: number; target: number };

export function scoreParts(weeks: ScoreWeek[]): { done: number; target: number } {
  const recent = weeks.filter((w) => w.target > 0).slice(-SCORE_WEEKS);
  return recent.reduce(
    (a, w) => ({ done: a.done + Math.min(Math.max(w.done, 0), w.target), target: a.target + w.target }),
    { done: 0, target: 0 }
  );
}

export function showingUpScore(weeks: ScoreWeek[]): number {
  const { done, target } = scoreParts(weeks);
  return target ? Math.round((done / target) * 100) : 0;
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Rock solid";
  if (score >= 75) return "Consistent";
  if (score >= 55) return "Building";
  return "Getting started";
}
