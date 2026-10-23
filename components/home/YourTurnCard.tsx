import type { YourTurnData } from "./types";
import { NudgeLine } from "./NudgeTime";

// The reason to move today: who in your pods already showed up, and what's
// left for a perfect week. It turns pod-mates' activity into "your turn"
// without anyone having to send a nudge. Covers every pod the member is in.

function names(list: string[]): string {
  if (list.length <= 1) return list[0] ?? "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]}, ${list[1]} and ${list.length - 2} more`;
}

export default function YourTurnCard({
  data,
  cta,
  moveTimes,
}: {
  data: YourTurnData;
  cta?: React.ReactNode;
  moveTimes?: React.ReactNode; // picker shown until they've set their times
}) {
  const others = data.others;
  const who = names(others.map((o) => o.name));
  const where = data.multiPod ? "your pods" : data.podName;

  let headline: string;
  let body: string;
  if (data.meRested) {
    headline = "Rest day, and it counts.";
    body = others.length
      ? `${who} ${others.length === 1 ? "is" : "are"} carrying ${where} today. You're back at it tomorrow.`
      : "Recovery is part of showing up. Your pod sees you resting, not missing.";
  } else if (data.meActive) {
    headline = "You showed up today.";
    body = others.length
      ? `So did ${who}.${
          data.remainingForPerfect === null
            ? ""
            : data.remainingForPerfect > 0
              ? ` ${data.remainingForPerfect} active ${data.remainingForPerfect === 1 ? "day" : "days"} left across the pod for a Pod Perfect week.`
              : " The pod's week is done."
        }`
      : `First one in today. ${data.multiPod ? "Your pods" : "Your pod"} got the heads-up.`;
  } else if (data.lastOnePod) {
    headline = "You're the last one.";
    body = `Everyone else in ${data.lastOnePod} has hit their goal. Your days are all that stand between the pod and a Pod Perfect week.`;
  } else if (others.length) {
    headline = "Your turn.";
    body = `${who} already showed up today. One activity from you keeps ${where} on track.`;
  } else {
    headline = "Be the first today.";
    body = `Nobody in ${where} has moved yet. The first log sets the tone, and everyone hears about it.`;
  }

  const showCta = !data.meActive && !data.meRested;

  return (
    <section className="mt-4 rounded-[28px] border border-line bg-card p-5 shadow-pod">
      <h2 className="font-serif text-[22px] font-semibold leading-tight text-ink">{headline}</h2>
      <p className="mt-1.5 text-[17px] leading-relaxed text-ink-soft">{body}</p>

      {others.length > 0 && (
        <ul className="mt-3.5 flex flex-col gap-2">
          {others.slice(0, 3).map((o, i) => (
            <li key={i} className="flex items-center gap-2.5 text-[17px]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 text-[17px]">
                {o.emoji}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink">
                <b className="font-semibold">{o.name}</b> · {o.label}
                {data.multiPod && o.pod && <span className="text-muted"> · {o.pod}</span>}
              </span>
              <span className="shrink-0 text-[15px] text-muted">{o.ago}</span>
            </li>
          ))}
        </ul>
      )}

      {showCta && cta && <div className="mt-4">{cta}</div>}

      {showCta && data.hasMoveTimes && <NudgeLine />}

      {!data.hasMoveTimes && moveTimes && (
        <div className="mt-4 border-t border-line pt-4">{moveTimes}</div>
      )}
    </section>
  );
}
