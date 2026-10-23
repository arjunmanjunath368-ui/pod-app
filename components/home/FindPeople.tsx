"use client";

import { useMemo, useState } from "react";

// Demo: find WHOOP members nearby who share your interests, and start a pod
// with them. Goals and fitness level play no part; interests and area do.
// Only members who turned on "Let people find me" appear. Simulated people.

const INTERESTS: { key: string; label: string; emoji: string }[] = [
  { key: "pickleball", label: "Pickleball", emoji: "🏓" },
  { key: "walking", label: "Walking", emoji: "🚶" },
  { key: "golf", label: "Golf", emoji: "⛳" },
  { key: "running", label: "Running", emoji: "🏃" },
  { key: "strength", label: "Strength", emoji: "🏋️" },
  { key: "padel", label: "Padel", emoji: "🎾" },
  { key: "yoga", label: "Yoga", emoji: "🧘" },
  { key: "cycling", label: "Cycling", emoji: "🚴" },
  { key: "swimming", label: "Swimming", emoji: "🏊" },
  { key: "hiking", label: "Hiking", emoji: "🥾" },
];

type Person = {
  name: string;
  initials: string;
  color: string;
  area: string;
  miles: number;
  interests: string[];
  when: string;
  wantsPod: boolean;
};

const PEOPLE: Person[] = [
  { name: "Nina R.", initials: "NR", color: "#7a9471", area: "South End", miles: 0.8, interests: ["pickleball", "yoga"], when: "Evenings", wantsPod: true },
  { name: "Omar S.", initials: "OS", color: "#5b7fa6", area: "South End", miles: 1.1, interests: ["padel", "pickleball"], when: "Evenings", wantsPod: true },
  { name: "Elena P.", initials: "EP", color: "#b07a4f", area: "Fenway", miles: 1.4, interests: ["walking", "pickleball"], when: "Evenings", wantsPod: true },
  { name: "Marcus T.", initials: "MT", color: "#8a6f9e", area: "Back Bay", miles: 0.3, interests: ["pickleball", "strength"], when: "Mornings", wantsPod: false },
  { name: "Chloe W.", initials: "CW", color: "#c8553d", area: "Beacon Hill", miles: 1.2, interests: ["running", "walking"], when: "Early mornings", wantsPod: true },
  { name: "Dev K.", initials: "DK", color: "#d9a441", area: "Back Bay", miles: 0.5, interests: ["golf", "walking"], when: "Weekends", wantsPod: false },
  { name: "Hannah L.", initials: "HL", color: "#6f8f66", area: "Kenmore", miles: 1.6, interests: ["golf", "hiking"], when: "Afternoons", wantsPod: true },
  { name: "Ravi M.", initials: "RM", color: "#2f4a37", area: "Back Bay", miles: 0.4, interests: ["cycling", "running"], when: "Mornings", wantsPod: false },
];

const label = (k: string) => INTERESTS.find((i) => i.key === k);

function SayHi() {
  const [sent, setSent] = useState(false);
  return (
    <button
      onClick={() => setSent(true)}
      disabled={sent}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
        sent ? "bg-paper-2 text-muted" : "bg-ink text-paper"
      }`}
    >
      {sent ? "Request sent" : "Say hi"}
    </button>
  );
}

export default function FindPeople() {
  const [picked, setPicked] = useState<string[]>(["pickleball", "walking"]);
  const [started, setStarted] = useState(false);

  const matches = useMemo(
    () =>
      PEOPLE.filter((p) => p.interests.some((i) => picked.includes(i))).sort((a, b) => {
        const sa = a.interests.filter((i) => picked.includes(i)).length;
        const sb = b.interests.filter((i) => picked.includes(i)).length;
        return sb - sa || a.miles - b.miles;
      }),
    [picked]
  );

  // The interest with the most people who want a pod: suggest starting one.
  const suggestion = useMemo(() => {
    let best: { key: string; people: Person[] } | null = null;
    for (const k of picked) {
      const ps = PEOPLE.filter((p) => p.wantsPod && p.interests.includes(k));
      if (ps.length >= 2 && (!best || ps.length > best.people.length)) best = { key: k, people: ps };
    }
    return best;
  }, [picked]);

  function toggle(k: string) {
    setStarted(false);
    setPicked((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.concat([k])));
  }

  return (
    <>
      <section className="mt-5 rounded-[24px] border border-line bg-card p-5">
        <h2 className="text-[15px] font-semibold text-ink">What do you like to do?</h2>
        <p className="mt-0.5 text-[13px] text-muted">Pick as many as you like.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = picked.includes(i.key);
            return (
              <button
                key={i.key}
                onClick={() => toggle(i.key)}
                aria-pressed={on}
                className={`rounded-full border-2 px-3.5 py-2 text-[14px] font-semibold transition active:scale-95 ${
                  on ? "border-terra bg-terra/[0.10] text-ink" : "border-line bg-paper text-ink-soft"
                }`}
              >
                {i.emoji} {i.label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3.5 text-[14px]">
          <span className="text-ink-soft">
            📍 <b className="font-semibold text-ink">Back Bay, Boston</b> · within 2 miles
          </span>
          <span className="text-[13px] font-semibold text-terra">Change</span>
        </div>
      </section>

      {suggestion && (
        <section className="mt-4 rounded-[28px] bg-ink p-5 text-paper shadow-pod-lg">
          <div className="text-[12px] font-semibold text-[#E3B04B]">✦ A pod waiting to happen</div>
          <h2 className="mt-1.5 font-serif text-[22px] font-semibold leading-tight">
            {suggestion.people.length} {label(suggestion.key)?.label.toLowerCase()} players near you want a pod
          </h2>
          <div className="mt-3 flex items-center">
            {suggestion.people.map((p, i) => (
              <span
                key={p.name}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-paper ring-2 ring-ink"
                style={{ backgroundColor: p.color, marginLeft: i ? -8 : 0 }}
              >
                {p.initials}
              </span>
            ))}
            <span className="ml-3 text-[14px] text-paper/90">
              {suggestion.people.map((p) => p.name.split(" ")[0]).join(", ")}
            </span>
          </div>
          <button
            onClick={() => setStarted(true)}
            disabled={started}
            className={`mt-4 w-full rounded-full px-4 py-2.5 text-[14px] font-semibold transition active:scale-[0.98] ${
              started ? "bg-paper/20 text-paper" : "bg-paper text-ink"
            }`}
          >
            {started ? "Invites sent. They'll hear from you ✓" : "Start a pod with them"}
          </button>
        </section>
      )}

      <section className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">WHOOP members near you</h2>
          <span className="text-[13px] tabular-nums text-muted">{matches.length} found</span>
        </div>
        {matches.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line p-4 text-center text-[14px] text-muted">
            Pick an interest to see who&apos;s nearby.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {matches.map((p) => (
              <li key={p.name} className="rounded-2xl border border-line bg-card p-3.5">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-paper"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold text-ink">{p.name}</span>
                      {p.wantsPod && (
                        <span className="shrink-0 rounded-full bg-gold/[0.18] px-2 py-0.5 text-[11px] font-semibold text-ink">
                          Wants a pod
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-muted">
                      {p.area} · {p.miles} mi · {p.when}
                    </div>
                  </div>
                  <SayHi />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[52px]">
                  {p.interests.map((k) => {
                    const it = label(k);
                    const shared = picked.includes(k);
                    return (
                      <span
                        key={k}
                        className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                          shared ? "bg-terra/[0.12] text-terra" : "bg-paper-2 text-muted"
                        }`}
                      >
                        {it?.emoji} {it?.label}
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
