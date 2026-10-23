"use client";

import { useInView } from "./InView";

// A progress ring, drawn to scale: the arc covers exactly `pct` of the circle.
// It fills from zero the first time it scrolls into view. `muted` draws a
// dashed, empty ring for data the member doesn't have yet.

export default function Ring({
  pct,
  size = 92,
  stroke = 9,
  color,
  track = "rgba(255,255,255,0.10)",
  muted = false,
  children,
  label,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
  track?: string;
  muted?: boolean;
  children?: React.ReactNode;
  label?: string;
}) {
  const { ref, seen } = useInView<HTMLDivElement>(0.4);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = seen ? c * (1 - clamped / 100) : c;
  return (
    <div
      ref={ref}
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(clamped)}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
          strokeDasharray={muted ? "3 6" : undefined}
        />
        {!muted && clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-[1100ms] ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
