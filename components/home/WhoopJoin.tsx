import Link from "next/link";

// For members without WHOOP: what they're missing, and a clear way in.
// `offer` shows the Pod member offer. It's a concept (not agreed with WHOOP),
// so only the demo pod passes it. It matches the earned 60-day trial model:
// 30 days free, and 30 more for hitting the pod goal in 3 of the first 4 weeks.

const PERKS: { color: string; text: string }[] = [
  { color: "#6FCF7F", text: "Recovery and sleep, every morning" },
  { color: "#E3B04B", text: "Activities log themselves" },
  { color: "#8FA8D8", text: "Red-recovery days count as rest" },
];

export default function WhoopJoin({
  connectHref = "/app/settings#whoop",
  offer = false,
  demo = false,
}: {
  connectHref?: string;
  offer?: boolean;
  demo?: boolean;
}) {
  const primaryCls =
    "flex items-center justify-center rounded-full bg-paper px-3 py-2.5 text-[16px] font-semibold text-ink transition active:scale-[0.98]";
  const secondaryCls =
    "flex items-center justify-center rounded-full border border-paper/30 px-3 py-2.5 text-[16px] font-semibold text-paper transition active:scale-[0.98]";
  const primaryLabel = offer ? "Start free trial" : "Join WHOOP";

  return (
    <div className="rounded-2xl bg-paper/[0.07] p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-semibold leading-snug text-paper">
          {offer ? "Get WHOOP with your pod" : "Fill these rings with WHOOP"}
        </h3>
        {offer && (
          <span className="shrink-0 rounded-full border border-paper/25 px-2.5 py-0.5 text-[13px] font-semibold text-sage-soft">
            Concept
          </span>
        )}
      </div>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {PERKS.map((p) => (
          <li key={p.text} className="flex items-center gap-2.5 text-[16px] text-paper/90">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
            {p.text}
          </li>
        ))}
      </ul>

      {offer && (
        <div className="mt-3.5 rounded-xl border border-[#E3B04B]/35 bg-[#E3B04B]/[0.12] px-3.5 py-3">
          <div className="text-[22px] font-semibold leading-none text-paper">Up to 60 days free</div>
          <div className="mt-1.5 text-[15px] leading-snug text-paper/85">
            30 days to start. Hit your pod goal in 3 of your first 4 weeks and get
            30 more, free.
          </div>
        </div>
      )}

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {demo ? (
          <>
            <span className={primaryCls}>{primaryLabel}</span>
            <span className={secondaryCls}>I have WHOOP</span>
          </>
        ) : (
          <>
            <a
              href="https://www.whoop.com/"
              target="_blank"
              rel="noopener noreferrer"
              className={primaryCls}
            >
              {primaryLabel}
            </a>
            <Link href={connectHref} className={secondaryCls}>
              I have WHOOP
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
