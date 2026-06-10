"use client";

import { useState } from "react";

type Props = {
  monthLabel: string;
  name: string;
  activeDays: number;
  sessions: number;
  dayStreak: number;
  goalWeeks: number;
  pbCount: number;
  challenges: number;
};

// Brand palette (canvas can't use CSS vars).
const INK = "#1a2e1f";
const PAPER = "#f4f0e6";
const SAGE = "#9bb091";
const TERRA = "#e0714f";
const GOLD = "#d9a441";
const MUTED = "#8a9a86";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function ShareMonthButton(props: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  function draw(): Promise<Blob | null> {
    const S = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);

    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, S, S);

    const pad = 90;

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = SAGE;
    ctx.font = "700 30px -apple-system, system-ui, sans-serif";
    ctx.fillText("🫛  P O D", pad, 130);

    ctx.fillStyle = PAPER;
    ctx.font = "600 92px Georgia, 'Times New Roman', serif";
    ctx.fillText(`My ${props.monthLabel}`, pad, 250);

    ctx.fillStyle = MUTED;
    ctx.font = "500 30px -apple-system, system-ui, sans-serif";
    ctx.fillText(`${props.name}'s month on Pod`, pad, 300);

    const tiles: { value: string; label: string; color: string }[] = [
      { value: String(props.activeDays), label: "active days", color: PAPER },
      { value: String(props.sessions), label: "sessions", color: PAPER },
      { value: `🔥${props.dayStreak}`, label: "day streak", color: TERRA },
      { value: `🎯${props.goalWeeks}`, label: "goal weeks", color: SAGE },
      { value: `🏆${props.pbCount}`, label: "new bests", color: GOLD },
      { value: `💪${props.challenges}`, label: "challenges", color: PAPER },
    ];

    const gridTop = 380;
    const gapX = 40;
    const gapY = 36;
    const colW = (S - pad * 2 - gapX) / 2;
    const rowH = 180;

    tiles.forEach((t, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = pad + col * (colW + gapX);
      const y = gridTop + row * (rowH + gapY);

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(ctx, x, y, colW, rowH, 28);
      ctx.fill();

      ctx.fillStyle = t.color;
      ctx.font = "700 76px -apple-system, system-ui, sans-serif";
      ctx.fillText(t.value, x + 40, y + 100);

      ctx.fillStyle = MUTED;
      ctx.font = "500 30px -apple-system, system-ui, sans-serif";
      ctx.fillText(t.label, x + 40, y + 145);
    });

    ctx.fillStyle = SAGE;
    ctx.font = "italic 600 34px Georgia, serif";
    ctx.fillText("The only thing we compete on is showing up.", pad, S - 90);

    return new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png", 0.92)
    );
  }

  async function share() {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const blob = await draw();
      if (!blob) {
        setNote("Couldn't build the card. Try again.");
        setBusy(false);
        return;
      }
      const file = new File(
        [blob],
        `my-${props.monthLabel.toLowerCase()}-on-pod.png`,
        { type: "image/png" }
      );
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `My ${props.monthLabel} on Pod`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        setNote("Saved the card to your downloads.");
      }
    } catch {
      // User cancelled the share sheet, or something failed — stay quiet.
    }
    setBusy(false);
  }

  return (
    <div className="mt-7">
      <button
        onClick={share}
        disabled={busy}
        className="w-full rounded-2xl border border-line bg-card py-3.5 text-[15px] font-semibold text-ink transition active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? "Building your card…" : "📤 Share my month"}
      </button>
      {note && <p className="mt-2 text-center text-[13px] text-muted">{note}</p>}
    </div>
  );
}
