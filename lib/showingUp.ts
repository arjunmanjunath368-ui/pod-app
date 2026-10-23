// Showing Up Score: how consistently someone hits their own weekly goal.
//
// WHOOP measures how hard you went and how well you recovered. This measures
// whether you showed up. It's the share of each week's goal you hit over the
// last 8 finished weeks, with recent weeks counting more (week 8 counts 8x as
// much as week 1), on a 0 to 100 scale.

export const SCORE_WEEKS = 8;

// `weekPcts`: % of goal hit in each finished week, oldest first (0 to 100).
export function showingUpScore(weekPcts: number[]): number {
  const weeks = weekPcts.slice(-SCORE_WEEKS);
  if (!weeks.length) return 0;
  let num = 0;
  let den = 0;
  weeks.forEach((p, i) => {
    const w = i + 1;
    num += w * Math.max(0, Math.min(100, p));
    den += w;
  });
  return Math.round(num / den);
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Rock solid";
  if (score >= 75) return "Consistent";
  if (score >= 55) return "Building";
  return "Getting started";
}
