"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Quick-fill presets for the "barely has 30 min" teammate. Links are robust
// YouTube searches so they never rot; the sender can swap in their own.
const PRESETS: { label: string; emoji: string; title: string; link: string }[] = [
  {
    label: "20-min full body",
    emoji: "🏋️",
    title: "20-min full body",
    link: "https://www.youtube.com/results?search_query=20+minute+full+body+workout+no+equipment",
  },
  {
    label: "30-min full body",
    emoji: "🏋️",
    title: "30-min full body",
    link: "https://www.youtube.com/results?search_query=30+minute+full+body+workout",
  },
  {
    label: "20-min cardio",
    emoji: "🫀",
    title: "20-min cardio",
    link: "https://www.youtube.com/results?search_query=20+minute+cardio+workout+at+home",
  },
  {
    label: "15-min mobility",
    emoji: "🧘",
    title: "15-min mobility flow",
    link: "https://www.youtube.com/results?search_query=15+minute+mobility+routine",
  },
  {
    label: "10-min core",
    emoji: "🔥",
    title: "10-min core",
    link: "https://www.youtube.com/results?search_query=10+minute+core+workout",
  },
  {
    label: "Play a sport",
    emoji: "🎾",
    title: "Play a sport today",
    link: "",
  },
];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function ChallengeButton({
  podId,
  fromUserId,
  toUserId,
  toName,
}: {
  podId: string;
  fromUserId: string;
  toUserId: string;
  toName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const firstName = toName.split(/\s+/)[0];

  function reset() {
    setTitle("");
    setLink("");
    setNote("");
    setError("");
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setTitle(p.title);
    setLink(p.link);
    setError("");
  }

  async function send() {
    const t = title.trim();
    if (!t) {
      setError("Give the challenge a title.");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("challenges").insert({
      pod_id: podId,
      from_user: fromUserId,
      to_user: toUserId,
      title: t,
      link: link.trim() || null,
      note: note.trim() || null,
      due_date: today(),
    });
    setBusy(false);
    if (err) {
      setError(
        err.code === "23505"
          ? `You've already got a challenge going with ${firstName}. Let that one land first.`
          : "Couldn't send that. Try again."
      );
      return;
    }
    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toUserId,
        kind: "challenge",
        challengeTitle: t,
        url: "/app",
      }),
    }).catch(() => {});
    setSent(true);
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => !sent && setOpen(true)}
        disabled={sent}
        className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
          sent ? "bg-paper-2 text-muted" : "bg-ink/[0.06] text-ink-soft"
        }`}
      >
        {sent ? "Challenged 💪" : "💪 Challenge"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => !busy && setOpen(false)}
          />
          <div className="sheet-enter relative w-full max-w-[420px] rounded-t-[28px] bg-paper px-6 pb-9 pt-3 shadow-pod-lg">
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" />

            <h2 className="font-serif text-[22px] font-semibold text-ink">
              Challenge {firstName}
            </h2>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              Set them a small one for today. It clears the moment they show up
              and log — no stopwatch required.
            </p>

            <div className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-muted">
              Quick picks
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const on = title === p.title;
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
                      on
                        ? "bg-terra text-white"
                        : "bg-card text-ink-soft ring-1 ring-line"
                    }`}
                  >
                    {p.emoji} {p.label}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  setTitle("");
                  setLink("");
                  setError("");
                }}
                className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-soft ring-1 ring-line transition active:scale-95"
              >
                ✏️ Write your own
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="relative">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Challenge (e.g. 20-min full body)"
                  className="w-full rounded-2xl border border-line bg-card px-4 py-3 pr-10 text-[15px] text-ink outline-none placeholder:text-muted focus:border-terra"
                />
                {title && (
                  <button
                    onClick={() => setTitle("")}
                    aria-label="Clear challenge"
                    className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-paper-2 text-[13px] text-muted active:scale-90"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="Link (optional) — paste your own YouTube or IG workout"
                  className="w-full rounded-2xl border border-line bg-card px-4 py-3 pr-10 text-[15px] text-ink outline-none placeholder:text-muted focus:border-terra"
                />
                {link && (
                  <button
                    onClick={() => setLink("")}
                    aria-label="Clear link"
                    className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-paper-2 text-[13px] text-muted active:scale-90"
                  >
                    ✕
                  </button>
                )}
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A line of encouragement (optional)"
                className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:border-terra"
              />
            </div>

            {error && <p className="mt-3 text-[13px] text-terra">{error}</p>}

            <button
              onClick={send}
              disabled={busy}
              className="mt-5 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "Sending…" : `Send to ${firstName} 💪`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
