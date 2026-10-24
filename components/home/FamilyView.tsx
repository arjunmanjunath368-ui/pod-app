"use client";

import { useState } from "react";
import FamilyInsight from "./FamilyInsight";
import { usePopover, MENU_CLS, MENU_ITEM_CLS } from "./Popover";

// Demo: Core sharing. Each person picks what they share with each other
// Core member; the metrics are ones WHOOP's developer API provides
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
        Mom&apos;s sleep: <b className="font-semibold">61%</b> this week, down from 78%. Yours rose from{" "}
        <b className="font-semibold">72% to 89%</b> with a fixed 10:30 pm bedtime.
      </>
    ),
    draft:
      "Mom, your sleep's been rough this week. A fixed 10:30 bedtime took mine from 72% to 89%. Want to try it together?",
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
        Dad&apos;s sleep consistency: <b className="font-semibold">86%</b> this week, his best in 3 months (average 71%).
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
      <span className="text-[17px] font-semibold text-paper">{m.label}</span>
      <span className="flex items-center gap-2 text-right">
        <span>
          <span className="block text-[21px] font-semibold leading-none tabular-nums text-paper">{m.value}</span>
          <span className="mt-1 block text-[14px] tabular-nums text-sage-soft">30-day avg {m.avg}</span>
        </span>
        <span aria-label={m.trend === "neutral" ? "about usual" : `${m.trend} than usual`} className="text-[14px]" style={{ color }}>
          {m.dir === "up" ? "▲" : "▼"}
        </span>
      </span>
    </li>
  );
}

const ASK: Record<string, { q: string; reply: string }> = {
  Sleep: {
    q: "My sleep has averaged 68% this month. I'd like it above 80%. What's worked for you?",
    reply: "Phone out of the bedroom by 10. My sleep went up within a week. Want to try it together?",
  },
  Recovery: {
    q: "My recovery has been in the yellow most mornings lately. Has anything helped yours?",
    reply: "No caffeine after 2 pm made the biggest difference for me. Took about two weeks to show up.",
  },
  "Showing up": {
    q: "I keep missing my Friday workouts. How do you keep going at the end of the week?",
    reply: "I book Friday as a walk, not a workout. Easier to say yes to. Join me this Friday?",
  },
  Stress: {
    q: "Work has been stressful and it's showing in my sleep. How do you switch off in the evenings?",
    reply: "A 20-minute walk after dinner, no podcasts. It's the only thing that works for me.",
  },
  "Strength training": {
    q: "I want to start strength training twice a week. How did you get started?",
    reply: "Two 30-minute sessions with the same 4 moves. Keep it boring and it sticks.",
  },
  Running: {
    q: "I'd like to run a 5k by spring. Any tips for starting slowly?",
    reply: "Run-walk: 1 minute running, 1 walking, three times a week. I'll send you my plan.",
  },
  "Eating well": {
    q: "I'm trying to eat better on weekdays. What's helped you?",
    reply: "Sunday prep: two big batches, lunches sorted for the week. Happy to share recipes.",
  },
  "Staying motivated": {
    q: "My motivation's dipped lately. What keeps you going when you don't feel like it?",
    reply: "I tell myself 10 minutes only. Most days I end up doing more.",
  },
  "Getting back after a break": {
    q: "I've been off for two weeks. How do you restart without overdoing it?",
    reply: "Start at half of what you used to do for a week. Your body catches up fast.",
  },
};
const MAIN_TOPICS = ["Sleep", "Recovery", "Showing up"];
const MORE_TOPICS = Object.keys(ASK).filter((k) => !MAIN_TOPICS.includes(k));

type Who = "mom" | "dad";
type Msg = { from: "me" | Who; text: string };
const PEOPLE: Record<Who, { name: string; initial: string; color: string }> = {
  mom: { name: "Mom", initial: "M", color: "#b07a4f" },
  dad: { name: "Dad", initial: "D", color: "#5b7fa6" },
};
const WHO: Who[] = ["mom", "dad"];

function names(list: Who[]): string {
  const n = list.map((w) => PEOPLE[w].name);
  return n.length === 2 ? `${n[0]} and ${n[1]}` : n[0] ?? "";
}

function AskFamily() {
  const [topic, setTopic] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [to, setTo] = useState<Who[]>(["mom", "dad"]);
  const [thread, setThread] = useState<Msg[]>([]);
  const [typing, setTyping] = useState<Who | null>(null);
  const more = usePopover();
  const sendTo = usePopover();

  function pick(t: string) {
    setTopic(t);
    setText(t === "own" ? "" : ASK[t].q);
    more.setOpen(false);
  }

  function toggle(w: Who) {
    setTo((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : WHO.filter((x) => x === w || cur.includes(x))));
  }

  function send() {
    const body = text.trim();
    if (!body || !to.length) return;
    setThread((th) => th.concat([{ from: "me", text: body }]));
    setText("");
    const replier = to[0];
    const reply = topic && topic !== "own" ? ASK[topic].reply : "Good question. Let me think, I'll call you tonight.";
    setTopic(null);
    setTyping(replier);
    setTimeout(() => {
      setTyping(null);
      setThread((th) => th.concat([{ from: replier, text: reply }]));
    }, 1400);
  }

  const chip = (on: boolean) =>
    `rounded-full border-2 px-3.5 py-2 text-[16px] font-semibold transition active:scale-95 ${
      on ? "border-terra bg-terra/[0.10] text-ink" : "border-line bg-paper text-ink-soft"
    }`;
  const moreTopic = topic && MORE_TOPICS.includes(topic) ? topic : null;

  return (
    <section className="mt-4 rounded-[24px] border border-line bg-card p-5">
      <h2 className="text-[20px] font-semibold text-ink">Working on something?</h2>
      <p className="mt-1 text-[17px] leading-relaxed text-ink-soft">
        Ask your Core for help. Pick a topic and Pod drafts the question.
      </p>

      <div ref={more.ref} className="relative mt-3 flex flex-wrap items-center gap-2">
        {MAIN_TOPICS.map((t) => (
          <button key={t} onClick={() => pick(t)} aria-pressed={topic === t} className={chip(topic === t)}>
            {t}
          </button>
        ))}
        <div>
          <button
            onClick={() => more.setOpen(!more.open)}
            aria-expanded={more.open}
            aria-haspopup="menu"
            className={`${chip(!!moreTopic)} inline-flex items-center gap-1.5`}
          >
            {moreTopic ?? "More"}
            <span aria-hidden className="text-[12px] text-muted">▾</span>
          </button>
          {more.open && (
            <div role="menu" ref={more.menu.ref} style={more.menu.style} className={`${MENU_CLS} ${more.menu.pos} right-0`}>
              {MORE_TOPICS.map((t) => (
                <button key={t} role="menuitem" onClick={() => pick(t)} className={MENU_ITEM_CLS}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => pick("own")} aria-pressed={topic === "own"} className={chip(topic === "own")}>
          Write your own
        </button>
      </div>

      {thread.length > 0 && (
        <div className="mt-4 rounded-2xl bg-paper-2/50 p-3">
          <ul className="flex flex-col gap-2">
            {thread.map((m, i) => (
              <li key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start gap-2"}`}>
                {m.from !== "me" && (
                  <span
                    className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-paper"
                    style={{ backgroundColor: PEOPLE[m.from].color }}
                  >
                    {PEOPLE[m.from].initial}
                  </span>
                )}
                <span
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[17px] leading-relaxed ${
                    m.from === "me" ? "bg-terra text-paper" : "bg-card text-ink"
                  }`}
                >
                  {m.text}
                </span>
              </li>
            ))}
            {typing && (
              <li className="flex items-center gap-2 text-[15px] text-muted">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-paper"
                  style={{ backgroundColor: PEOPLE[typing].color }}
                >
                  {PEOPLE[typing].initial}
                </span>
                {PEOPLE[typing].name} is typing…
              </li>
            )}
          </ul>
        </div>
      )}

      {(topic || thread.length > 0) && (
        <div className="mt-3">
          <div ref={sendTo.ref} className="relative mb-2 flex items-center gap-2">
            <span className="text-[16px] text-ink-soft">To</span>
            <button
              onClick={() => sendTo.setOpen(!sendTo.open)}
              aria-expanded={sendTo.open}
              aria-haspopup="menu"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-line bg-paper px-3.5 py-1.5 text-[16px] font-semibold text-ink"
            >
              {to.length === WHO.length ? "Everyone" : to.length ? names(to) : "Pick someone"}
              <span aria-hidden className="text-[12px] text-muted">▾</span>
            </button>
            {sendTo.open && (
              <div role="menu" ref={sendTo.menu.ref} style={sendTo.menu.style} className={`${MENU_CLS} ${sendTo.menu.pos} left-8`}>
                <button
                  role="menuitemcheckbox"
                  aria-checked={to.length === WHO.length}
                  onClick={() => setTo(to.length === WHO.length ? [] : WHO.slice())}
                  className={MENU_ITEM_CLS}
                >
                  <Check on={to.length === WHO.length} />
                  Everyone
                </button>
                <div className="mx-4 my-1 h-px bg-line" />
                {WHO.map((w) => (
                  <button
                    key={w}
                    role="menuitemcheckbox"
                    aria-checked={to.includes(w)}
                    onClick={() => toggle(w)}
                    className={MENU_ITEM_CLS}
                  >
                    <Check on={to.includes(w)} />
                    {PEOPLE[w].name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="sr-only" htmlFor="family-msg">
            Message
          </label>
          <textarea
            id="family-msg"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Write a message…"
            className="w-full resize-none rounded-2xl border-2 border-line bg-paper p-3.5 text-[17px] leading-relaxed text-ink outline-none focus:border-terra"
          />
          <button
            onClick={send}
            disabled={!text.trim() || !to.length}
            className="mt-2 w-full rounded-full bg-ink px-4 py-3 text-[17px] font-semibold text-paper transition disabled:opacity-40 active:scale-[0.98]"
          >
            {to.length ? `Send to ${names(to)}` : "Pick who to send to"}
          </button>
        </div>
      )}
    </section>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
        on ? "border-terra bg-terra" : "border-line bg-paper"
      }`}
    >
      {on && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fffdf7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.5 5 9l4.5-6" />
        </svg>
      )}
    </span>
  );
}

export default function FamilyView() {
  const [sel, setSel] = useState("mom");
  const m = MEMBERS.find((x) => x.key === sel) ?? MEMBERS[0];

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {MEMBERS.map((f) => {
          const on = f.key === sel;
          return (
            <button
              key={f.key}
              onClick={() => setSel(f.key)}
              aria-pressed={on}
              className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[17px] font-semibold transition active:scale-95 ${
                on ? "bg-ink text-paper" : "bg-card text-ink-soft ring-1 ring-line"
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold text-paper" style={{ backgroundColor: f.color }}>
                {f.initials}
              </span>
              {f.name}
            </button>
          );
        })}
        <span className="flex h-10 items-center whitespace-nowrap rounded-full border border-dashed border-line px-3.5 text-[16px] font-semibold text-muted">
          + Add someone
        </span>
      </div>

      <FamilyInsight key={m.key} name={m.name} insight={m.insight} draft={m.draft} actionLabel={m.actionLabel} />

      <section className="mt-4 rounded-[28px] bg-ink p-5 text-paper shadow-pod-lg">
        <div className="flex items-center justify-between gap-3">
          <label className="relative">
            <span className="sr-only">Core member</span>
            <select
              value={sel}
              onChange={(e) => setSel(e.target.value)}
              className="appearance-none rounded-full bg-paper/[0.10] py-1.5 pl-3.5 pr-8 text-[17px] font-semibold text-paper outline-none"
            >
              {MEMBERS.map((f) => (
                <option key={f.key} value={f.key} className="text-ink">
                  {f.name}
                </option>
              ))}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-sage-soft">
              ▾
            </span>
          </label>
          <span className="text-right text-[15px] leading-snug text-sage-soft">
            Last 7 days
            <br />
            vs 30-day average
          </span>
        </div>
        {m.groups.map((g) => (
          <div key={g.title} className="mt-4">
            <h3 className="mb-2 text-[16px] font-semibold text-sage-soft">{g.title}</h3>
            <ul className="flex flex-col gap-2">
              {g.rows.map((r) => (
                <Row key={r.label} m={r} />
              ))}
            </ul>
          </div>
        ))}
        {m.shares.length < ALL.length && (
          <p className="mt-4 text-[16px] leading-relaxed text-sage-soft">
            {m.name} doesn&apos;t share {ALL.filter((a) => !m.shares.includes(a)).join(" or ").toLowerCase()} with you.
          </p>
        )}
      </section>

      <section className="mt-4 rounded-[24px] border border-line bg-card p-5">
        <h2 className="text-[20px] font-semibold text-ink">What you share with {m.name}</h2>
        <dl className="mt-3 flex flex-col gap-3 text-[16px]">
          {[
            { label: `${m.name} shares with you`, on: m.shares },
            { label: `You share with ${m.name}`, on: m.youShare },
          ].map((row) => (
            <div key={row.label}>
              <dt className="text-[15px] font-semibold text-muted">{row.label}</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {ALL.map((c) =>
                  row.on.includes(c) ? (
                    <span key={c} className="rounded-full bg-sage/[0.16] px-2.5 py-1 text-[16px] font-semibold text-ink">
                      {c}
                    </span>
                  ) : (
                    <span key={c} className="rounded-full border border-dashed border-line px-2.5 py-1 text-[16px] font-semibold text-muted">
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
