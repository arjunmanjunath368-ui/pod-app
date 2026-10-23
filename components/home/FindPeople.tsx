"use client";

import { useMemo, useState } from "react";

// Demo: find WHOOP members in your neighborhood who share your interests, and start a pod
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

type Gender = "woman" | "man" | "other";

type Person = {
  name: string;
  initials: string;
  color: string;
  area: string;
  miles: number;
  interests: string[];
  when: string;
  wantsPod: boolean;
  age: number;
  gender: Gender | null; // null: chose not to share
};

const PEOPLE: Person[] = [
  { name: "Nina R.", initials: "NR", color: "#7a9471", area: "South End", miles: 0.8, interests: ["pickleball", "yoga"], when: "Evenings", wantsPod: true, age: 31, gender: "woman" },
  { name: "Sky A.", initials: "SA", color: "#6f8f66", area: "South End", miles: 0.9, interests: ["walking", "yoga"], when: "Evenings", wantsPod: true, age: 28, gender: "other" },
  { name: "Omar S.", initials: "OS", color: "#5b7fa6", area: "South End", miles: 1.1, interests: ["padel", "pickleball"], when: "Evenings", wantsPod: true, age: 34, gender: "man" },
  { name: "Elena P.", initials: "EP", color: "#b07a4f", area: "Fenway", miles: 1.4, interests: ["walking", "pickleball"], when: "Evenings", wantsPod: true, age: 29, gender: "woman" },
  { name: "Marcus T.", initials: "MT", color: "#8a6f9e", area: "Back Bay", miles: 0.3, interests: ["pickleball", "strength"], when: "Mornings", wantsPod: false, age: 42, gender: "man" },
  { name: "Chloe W.", initials: "CW", color: "#c8553d", area: "Beacon Hill", miles: 1.2, interests: ["running", "walking"], when: "Early mornings", wantsPod: true, age: 27, gender: "woman" },
  { name: "Dev K.", initials: "DK", color: "#d9a441", area: "Back Bay", miles: 0.5, interests: ["golf", "walking"], when: "Weekends", wantsPod: false, age: 53, gender: null },
  { name: "Hannah L.", initials: "HL", color: "#6f8f66", area: "Kenmore", miles: 1.6, interests: ["golf", "hiking"], when: "Afternoons", wantsPod: true, age: 46, gender: "woman" },
  { name: "Ravi M.", initials: "RM", color: "#2f4a37", area: "Back Bay", miles: 0.4, interests: ["cycling", "running"], when: "Mornings", wantsPod: false, age: 36, gender: "man" },
];

const AGES: { key: string; label: string; min: number; max: number }[] = [
  { key: "any", label: "Any age", min: 0, max: 200 },
  { key: "20s", label: "20s", min: 20, max: 29 },
  { key: "30s", label: "30s", min: 30, max: 39 },
  { key: "40s", label: "40s", min: 40, max: 49 },
  { key: "50+", label: "50+", min: 50, max: 200 },
];

const label = (k: string) => INTERESTS.find((i) => i.key === k);

function SayHi() {
  const [sent, setSent] = useState(false);
  return (
    <button
      onClick={() => setSent(true)}
      disabled={sent}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[15px] font-semibold transition active:scale-95 ${
        sent ? "bg-paper-2 text-muted" : "bg-ink text-paper"
      }`}
    >
      {sent ? "Request sent" : "Say hi"}
    </button>
  );
}

export default function FindPeople() {
  const [picked, setPicked] = useState<string[]>(["pickleball", "walking"]);
  const [age, setAge] = useState("any");
  const [gender, setGender] = useState<"any" | Gender>("any");
  const [started, setStarted] = useState(false);
  const [area, setArea] = useState("Back Bay, Boston");
  const [radius, setRadius] = useState(2);
  const [editingArea, setEditingArea] = useState(false);

  const fits = (p: Person) => {
    if (p.miles > radius) return false;
    const a = AGES.find((x) => x.key === age) ?? AGES[0];
    if (p.age < a.min || p.age > a.max) return false;
    if (gender !== "any" && p.gender !== gender) return false;
    return true;
  };

  const matches = useMemo(
    () =>
      PEOPLE.filter((p) => fits(p) && p.interests.some((i) => picked.includes(i))).sort((a, b) => {
        const sa = a.interests.filter((i) => picked.includes(i)).length;
        const sb = b.interests.filter((i) => picked.includes(i)).length;
        return sb - sa || a.miles - b.miles;
      }),
    [picked, age, gender, radius] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The interest with the most people who want a pod: suggest starting one.
  const suggestion = useMemo(() => {
    let best: { key: string; people: Person[] } | null = null;
    for (const k of picked) {
      const ps = PEOPLE.filter((p) => fits(p) && p.wantsPod && p.interests.includes(k));
      if (ps.length >= 2 && (!best || ps.length > best.people.length)) best = { key: k, people: ps };
    }
    return best;
  }, [picked, age, gender, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(k: string) {
    setStarted(false);
    setPicked((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.concat([k])));
  }

  return (
    <>
      <section className="mt-5 rounded-[24px] border border-line bg-card p-5">
        <h2 className="text-[19px] font-semibold text-ink">What do you like to do?</h2>
        <p className="mt-0.5 text-[16px] text-muted">Pick as many as you like.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = picked.includes(i.key);
            return (
              <button
                key={i.key}
                onClick={() => toggle(i.key)}
                aria-pressed={on}
                className={`rounded-full border-2 px-3.5 py-2 text-[16px] font-semibold transition active:scale-95 ${
                  on ? "border-terra bg-terra/[0.10] text-ink" : "border-line bg-paper text-ink-soft"
                }`}
              >
                {i.emoji} {i.label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 border-t border-line pt-3.5">
          <h3 className="text-[17px] font-semibold text-ink">Who you&apos;d like to move with</h3>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {AGES.map((a) => (
              <button
                key={a.key}
                onClick={() => {
                  setAge(a.key);
                  setStarted(false);
                }}
                aria-pressed={age === a.key}
                className={`rounded-full px-3 py-1.5 text-[16px] font-semibold transition active:scale-95 ${
                  age === a.key ? "bg-ink text-paper" : "bg-paper-2 text-ink-soft"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(
              [
                ["any", "Anyone"],
                ["woman", "Women"],
                ["man", "Men"],
                ["other", "Other"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => {
                  setGender(k);
                  setStarted(false);
                }}
                aria-pressed={gender === k}
                className={`rounded-full px-3 py-1.5 text-[16px] font-semibold transition active:scale-95 ${
                  gender === k ? "bg-ink text-paper" : "bg-paper-2 text-ink-soft"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Age and gender are optional for everyone. People who don&apos;t share them only show under Any age and Anyone.
          </p>
        </div>
        <div className="mt-4 border-t border-line pt-3.5">
          <div className="flex items-center justify-between gap-3 text-[17px]">
            <span className="flex min-w-0 items-start gap-2">
              <span aria-hidden>📍</span>
              <span className="min-w-0">
                <b className="block font-semibold text-ink">{area}</b>
                <span className="block text-[16px] text-ink-soft">
                  Within {radius} {radius === 1 ? "mile" : "miles"}
                </span>
              </span>
            </span>
            <button
              onClick={() => setEditingArea((v) => !v)}
              aria-expanded={editingArea}
              className="shrink-0 text-[16px] font-semibold text-terra"
            >
              {editingArea ? "Done" : "Change"}
            </button>
          </div>
          {editingArea && (
            <div className="mt-3 rounded-2xl bg-paper-2/60 p-3.5">
              <label className="block text-[15px] font-semibold text-muted" htmlFor="area">
                Neighborhood
              </label>
              <div className="relative mt-1.5">
                <select
                  id="area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full appearance-none rounded-xl border-2 border-line bg-card py-2.5 pl-3.5 pr-9 text-[17px] font-semibold text-ink outline-none focus:border-terra"
                >
                  {[
                    "Back Bay, Boston",
                    "South End, Boston",
                    "Fenway, Boston",
                    "Beacon Hill, Boston",
                    "Seaport, Boston",
                    "Jamaica Plain, Boston",
                    "Cambridge",
                    "Somerville",
                    "Brookline",
                  ].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[14px] text-muted">
                  ▾
                </span>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <label htmlFor="radius" className="text-[15px] font-semibold text-muted">
                  How far you&apos;d go
                </label>
                <span className="text-[17px] font-semibold tabular-nums text-ink">
                  {radius} {radius === 1 ? "mile" : "miles"}
                </span>
              </div>
              <input
                id="radius"
                type="range"
                min={1}
                max={10}
                step={1}
                value={radius}
                onChange={(e) => {
                  setRadius(Number(e.target.value));
                  setStarted(false);
                }}
                className="mt-2 h-2 w-full cursor-pointer accent-[#c8553d]"
              />
              <div className="mt-1 flex justify-between text-[14px] text-muted">
                <span>1 mile</span>
                <span>10 miles</span>
              </div>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted">
                Pod uses your neighborhood, never your exact location.
              </p>
            </div>
          )}
        </div>
      </section>

      {suggestion && (
        <section className="mt-4 rounded-[28px] bg-ink p-5 text-paper shadow-pod-lg">
          <div className="text-[14px] font-semibold text-[#E3B04B]">✦ A pod waiting to happen</div>
          <h2 className="mt-1.5 font-serif text-[22px] font-semibold leading-tight">
            {suggestion.people.length} {label(suggestion.key)?.label.toLowerCase()} players near you want a pod
          </h2>
          <div className="mt-3 flex items-center">
            {suggestion.people.map((p, i) => (
              <span
                key={p.name}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-paper ring-2 ring-ink"
                style={{ backgroundColor: p.color, marginLeft: i ? -8 : 0 }}
              >
                {p.initials}
              </span>
            ))}
            <span className="ml-3 text-[16px] text-paper/90">
              {suggestion.people.map((p) => p.name.split(" ")[0]).join(", ")}
            </span>
          </div>
          <button
            onClick={() => setStarted(true)}
            disabled={started}
            className={`mt-4 w-full rounded-full px-4 py-2.5 text-[16px] font-semibold transition active:scale-[0.98] ${
              started ? "bg-paper/20 text-paper" : "bg-paper text-ink"
            }`}
          >
            {started ? "Invites sent. They'll hear from you ✓" : "Start a pod with them"}
          </button>
        </section>
      )}

      <section className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[19px] font-semibold text-ink">WHOOP members near you</h2>
          <span className="text-[15px] tabular-nums text-muted">{matches.length} found</span>
        </div>
        {matches.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line p-4 text-center text-[16px] text-muted">
            {picked.length ? "Nobody in your neighborhood matches yet. Try more interests, a wider age range or a longer distance." : "Pick an interest to see who's in your neighborhood."}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {matches.map((p) => (
              <li key={p.name} className="rounded-2xl border border-line bg-card p-3.5">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-paper"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[17px] font-semibold text-ink">{p.name}</span>
                      {p.wantsPod && (
                        <span className="shrink-0 rounded-full bg-gold/[0.18] px-2 py-0.5 text-[13px] font-semibold text-ink">
                          Wants a pod
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[16px] leading-snug text-muted">
                      {p.age} · {p.area} · {p.miles} mi · {p.when}
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
                        className={`rounded-full px-2.5 py-0.5 text-[14px] font-semibold ${
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
