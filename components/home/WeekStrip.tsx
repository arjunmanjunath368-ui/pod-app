import type { WeekDay } from "./types";
import InView from "./InView";

// A week as seven days. Big variant on the Today card (dark), small dots on
// each member row (light).

export function WeekStripLarge({ days }: { days: WeekDay[] }) {
  return (
    <InView className="grid grid-cols-7 gap-1.5">
      {days.map((d, i) => {
        const base =
          "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[15px] leading-none";
        let cls = "";
        let inner: React.ReactNode = null; // icon inside the day
        let label = "";
        switch (d.state) {
          case "active":
            cls = "bg-[#E3B04B]";
            inner = (
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="#1a2e1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2.5 6.5 5 9l4.5-6" />
              </svg>
            );
            label = "active";
            break;
          case "rest":
            cls = "bg-[#8FA8D8]/50";
            inner = "💤";
            label = "rest day";
            break;
          case "today":
            cls = "border-2 border-dashed border-paper/50";
            label = "today, not yet";
            break;
          case "missed":
            cls = "bg-paper/[0.07]";
            label = "no activity";
            break;
          case "off":
            cls = "";
            inner = <span className="h-px w-3 bg-paper/20" />;
            label = "before joining";
            break;
          default:
            cls = "border border-paper/[0.12]";
            label = "coming up";
        }
        return (
          <div key={i} role="listitem" className="flex flex-col items-center gap-1.5">
            <span
              className={`text-[11px] font-semibold ${
                d.isToday ? "text-paper" : "text-sage-soft/80"
              }`}
            >
              {d.letter}
            </span>
            <span
              className={`pop-in ${base} ${cls} ${
                d.isToday && d.state !== "today" ? "ring-2 ring-paper/70 ring-offset-2 ring-offset-ink" : ""
              }`}
              aria-label={`${d.letter}: ${label}`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              {inner}
            </span>
          </div>
        );
      })}
    </InView>
  );
}

export function WeekDots({ days }: { days: WeekDay[] }) {
  return (
    <div className="flex items-center gap-[5px]" aria-hidden>
      {days.map((d, i) => {
        let cls = "border border-line bg-transparent";
        if (d.state === "active") cls = "bg-terra";
        else if (d.state === "rest") cls = "bg-[#8FA8D8]";
        else if (d.state === "missed") cls = "bg-paper-2";
        else if (d.state === "off") cls = "bg-transparent";
        else if (d.state === "today") cls = "border-[1.5px] border-dashed border-muted/70";
        return (
          <span
            key={i}
            className={`h-[9px] w-[9px] rounded-full ${cls} ${
              d.isToday && d.state !== "today" ? "outline outline-[1.5px] outline-offset-[1.5px] outline-ink/40" : ""
            }`}
          />
        );
      })}
    </div>
  );
}
