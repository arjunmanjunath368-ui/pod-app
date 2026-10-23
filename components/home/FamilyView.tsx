"use client";

import { useState } from "react";
import FamilyInsight from "./FamilyInsight";

// Demo: family sharing. Each person picks what they share with each other
// family member; the metrics are ones WHOOP's developer API provides
// (recovery, sleep and cycle data). Simulated.

type Metric = {
  label: string;
  value: string;
  avg: string; // 30-day average
  trend: "better" | "worse" | "neutral";
  dir: "up" | "down";
};
type Group = { title: string; rows: Metric[] };

type Member = {
  key: string;
  name: string;
  initials: string;
  color: string;
  relation: string;
  shares: string[];
  youShare: string[];
  groups: Group[];
  insight: React.ReactNode;
  draft: string;
  actionLabel: string;
};

const ALL = ["Sleep", "Recovery", "Heart", "Activity"];

const MEMBERS: Member[] = [
  {
    key: "mom",
    name: "Mom",
    initials: "M",
    color: "#b07a4f",
    relation: "Mom",
    shares: ["Sleep", "Recovery", "Heart", "Activity"],
    youShare: ["Sleep", "Recovery"],
    groups: [
      {
        title: "Sleep",
        rows: [
          { label: "Sleep performance", value: "61%", avg: "78%", trend: "worse", dir: "down" },
          { label: "Sleep consistency", value: "58%", avg: "74%", trend: "worse", dir: "down" },
          { label: "Hours of sleep", value: "6:12", avg: "7:05", trend: "worse", dir: "down" },
          { label: "Restorative sleep", value: "2:05", avg: "2:51", trend: "worse", dir: "down" },
        ],
      },
      {
        title: "Recovery",
        rows: [
          { label: "Recovery", value: "48%", avg: "63%", trend: "worse", dir: "down" },
          { label: "Heart rate variability", value: "38", avg: "45", trend: "worse", dir: "down" },
          { label: "Resting heart rate", value: "62", avg: "58", trend: "worse", dir: "up" },
          { label: "Respiratory rate", value: "14.8", avg: "14.6", trend: "neutral", dir: "up" },
        ],
      },
      {
        title: "Activity",
        rows: [{ label: "Day strain", value: "9.4", avg: "10.1", trend: "neutral", dir: "down" }],
      },
    ],
    insight: (
      <>
        Mom&apos;s sleep has averaged <b className="font-semibold">61%</b> over the last 7 days, down from her 30-day
        average of 78%. Yours went from <b className="font-semibold">72% to 89%</b> after you started a fixed 10:30 pm
        bedtime in September.
      </>
    ),
    draft:
      "Mom, I saw your sleep's been rough this week. What helped me most was going to bed at 10:30 every night, even on weekends. My sleep went from 72% to 89%. Want to try it together this week?",
    actionLabel: "Share what worked",
  },
  {
    key: "dad",
    name: "Dad",
    initials: "D",
    color: "#5b7fa6",
    relation: "Dad",
    shares: ["Sleep", "Activity"],
    youShare: ["Sleep", "Activity"],
    groups: [
      {
        title: "Sleep",
        rows: [
          { label: "Sleep performance", value: "84%", avg: "76%", trend: "better", dir: "up" },
          { label: "Sleep consistency", value: "86%", avg: "71%", trend: "better", dir: "up" },
          { label: "Hours of sleep", value: "7:22", avg: "6:48", trend: "better", dir: "up" },
          { label: "Restorative sleep", value: "3:02", avg: "2:40", trend: "better", dir: "up" },
        ],
      },
      {
        title: "Activity",
        rows: [{ label: "Day strain", value: "11.2", avg: "10.4", trend: "neutral", dir: "up" }],
      },
    ],
    insight: (
      <>
        Dad&apos;s sleep consistency hit <b className="font-semibold">86%</b> over the last 7 days, his best in 3 months
        and well above his 30-day average of 71%.
      </>
    ),
    draft: "Dad, 86% sleep consistency, your best in 3 months! Whatever you changed, it's working 👏",
    actionLabel: "Send a cheer",
  },
];

function Row({ m }: { m: Metric }) {
  const color = m.trend === "better" ? "#6FCF7F" : m.trend === "worse" ? "#E8A25A" : "rgba(244,240,230,0.45)";
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-paper/[0.06] px-4 py-3">
      <span className="text-[15px] font-semibold text-paper">{m.label}</span>
      <span className="flex items-center gap-2 text-right">
        <span>
          <span className="block text-[21px] font-semibold leading-none tabular-nums text-paper">{m.value}</span>
          <span className="mt-1 block text-[12px] tabular-nums text-sage-soft">30-day avg {m.avg}</span>
        </span>
        <span aria-label={m.trend === "neutral" ? "about usual" : `${m.trend} than usual`} className="text-[12px]" style={{ color }}>
          {m.dir === "up" ? "▲" : "▼"}
        </span>
      </span>
    </li>
  );
}

function AskFamily() {
  const TOPICS = ["Sleep", "Recovery", "Showing up"];
  const [topic, setTopic] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const messages: Record<string, string> = {
    Sleep:
      "I'm trying to sleep better. My sleep has averaged 68% this month and I'd like it above 80%. What's worked for you?",
    Recovery:
      "My recovery has been in the yellow most mornings lately. Has anything helped yours? I'd love a tip.",
    "Showing up":
      "I keep missing my Friday workouts. How do you keep going at the end of the week?",
  };
  return (
    <section className="mt-4 rounded-[24px] border border-line bg-card p-5">
      <h2 className="text-[18px] font-semibold text-ink">Working on something?</h2>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
        Ask your family for help. Pick what you&apos;re working on and Pod drafts the question. Each of them also sees
        what worked in their own data, so their answer is more than a guess.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTopic(t);
              setSent(false);
            }}
            aria-pressed={topic === t}
            className={`rounded-full border-2 px-3.5 py-2 text-[14px] font-semibold transition active:scale-95 ${
              topic === t ? "border-terra bg-terra/[0.10] text-ink" : "border-line bg-paper text-ink-soft"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {topic && (
        <div className="mt-4">
          <div className="text-[13px] font-semibold text-muted">Your question to Mom and Dad</div>
          <p className="mt-1.5 rounded-2xl bg-paper-2/70 p-3.5 text-[15px] leading-relaxed text-ink">{messages[topic]}</p>
          <button
            onClick={() => setSent(true)}
            disabled={sent}
            className={`mt-3 w-full rounded-full px-4 py-2.5 text-[15px] font-semibold transition active:scale-[0.98] ${
              sent ? "bg-paper-2 text-muted" : "bg-ink text-paper"
            }`}
          >
            {sent ? "Asked Mom and Dad ✓" : "Ask Mom and Dad"}
          </button>
        </div>
      )}
    </section>
  );
}

export default function FamilyView() {
  const [sel, setSel] = useState("mom");
  const m = MEMBERS.find((x) => x.key === sel) ?? MEMBERS[0];

  return (
    <>
      <div className="mt-4 flex items-center gap-2.5">
        {MEMBERS.map((f) => {
          const on = f.key === sel;
          return (
            <button
              key={f.key}
              onClick={() => setSel(f.key)}
              aria-pressed={on}
              className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[15px] font-semibold transition active:scale-95 ${
                on ? "bg-ink text-paper" : "bg-card text-ink-soft ring-1 ring-line"
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-paper" style={{ backgroundColor: f.color }}>
                {f.initials}
              </span>
              {f.name}
            </button>
          );
        })}
        <span className="flex h-10 items-center rounded-full border border-dashed border-line px-3.5 text-[14px] font-semibold text-muted">
          + Add family
        </span>
      </div>

      <FamilyInsight key={m.key} name={m.name} insight={m.insight} draft={m.draft} actionLabel={m.actionLabel} />

      <section className="mt-4 rounded-[28px] bg-ink p-5 text-paper shadow-pod-lg">
        <div className="flex items-center justify-between gap-3">
          <label className="relative">
            <span className="sr-only">Family member</span>
            <select
              value={sel}
              onChange={(e) => setSel(e.target.value)}
              className="appearance-none rounded-full bg-paper/[0.10] py-1.5 pl-3.5 pr-8 text-[16px] font-semibold text-paper outline-none"
            >
              {MEMBERS.map((f) => (
                <option key={f.key} value={f.key} className="text-ink">
                  {f.name}
                </option>
              ))}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-sage-soft">
              ▾
            </span>
          </label>
          <span className="text-right text-[13px] leading-snug text-sage-soft">
            Last 7 days
            <br />
            vs 30-day average
          </span>
        </div>
        {m.groups.map((g) => (
          <div key={g.title} className="mt-4">
            <h3 className="mb-2 text-[14px] font-semibold text-sage-soft">{g.title}</h3>
            <ul className="flex flex-col gap-2">
              {g.rows.map((r) => (
                <Row key={r.label} m={r} />
              ))}
            </ul>
          </div>
        ))}
        {m.shares.length < ALL.length && (
          <p className="mt-4 text-[14px] leading-relaxed text-sage-soft">
            {m.name} doesn&apos;t share {ALL.filter((a) => !m.shares.includes(a)).join(" or ").toLowerCase()} with you.
          </p>
        )}
      </section>

      <section className="mt-4 rounded-[24px] border border-line bg-card p-5">
        <h2 className="text-[18px] font-semibold text-ink">What you share with {m.name}</h2>
        <dl className="mt-3 flex flex-col gap-3 text-[14px]">
          {[
            { label: `${m.name} shares with you`, on: m.shares },
            { label: `You share with ${m.name}`, on: m.youShare },
          ].map((row) => (
            <div key={row.label}>
              <dt className="text-[13px] font-semibold text-muted">{row.label}</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {ALL.map((c) =>
                  row.on.includes(c) ? (
                    <span key={c} className="rounded-full bg-sage/[0.16] px-2.5 py-1 text-[14px] font-semibold text-ink">
                      {c}
                    </span>
                  ) : (
                    <span key={c} className="rounded-full border border-dashed border-line px-2.5 py-1 text-[14px] font-semibold text-muted">
                      {c}
                    </span>
                  )
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <AskFamily />
    </>
  );
}
