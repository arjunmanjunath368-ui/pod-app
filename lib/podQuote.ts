// The line at the top of Home: short, motivating, and about this pod right
// now. It changes with the pod's week, so it never reads like a poster.

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function word(n: number, capital = false): string {
  const w = n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
  return capital ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

function names(list: string[]): string {
  if (list.length <= 1) return list[0] ?? "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]}, ${list[1]} and ${list.length - 2} more`;
}

export type PodQuoteInput = {
  streak: number; // Pod Perfect weeks in a row, before this one
  perfect: boolean; // this week is already a Pod Perfect week
  remaining: number; // active days left across the pod for a perfect week
  othersToday: string[]; // pod-mates who already moved today
  meActive: boolean;
  lastOne: boolean; // everyone else has hit their goal
};

export function podQuote(p: PodQuoteInput): string {
  if (p.perfect) return "Everyone showed up. That’s what a pod is for.";
  if (p.lastOne) return "The whole pod is in. Bring it home.";
  if (p.streak >= 2) return `${word(p.streak, true)} perfect weeks together. Make it ${word(p.streak + 1)}.`;
  if (!p.meActive && p.othersToday.length) return `${names(p.othersToday)} already moved. Momentum is contagious.`;
  if (p.remaining > 0 && p.remaining <= 3)
    return `${word(p.remaining, true)} ${p.remaining === 1 ? "day" : "days"} from a perfect week. Together, that’s close.`;
  if (p.streak === 1) return "One perfect week down. The second is where it sticks.";
  return "Small days, done together, add up.";
}
