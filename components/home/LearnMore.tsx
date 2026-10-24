"use client";

// Jumps to a section further down the page.
export default function LearnMore({
  target,
  label = "Learn more",
  dark = false,
}: {
  target: string;
  label?: string;
  dark?: boolean; // on an ink card
}) {
  return (
    <a
      href={`#${target}`}
      onClick={(e) => {
        const el = document.getElementById(target);
        if (!el) return;
        e.preventDefault();
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[14px] font-semibold transition active:scale-95 ${
        dark ? "bg-paper/[0.12] text-paper" : "bg-ink/[0.06] text-ink-soft"
      }`}
    >
      {label} ›
    </a>
  );
}
