import { DemoTopBar, DemoPager } from "@/components/home/DemoNav";
import FindPeople from "@/components/home/FindPeople";

export const dynamic = "force-dynamic";

// Demo: find WHOOP members in your neighborhood by interest and start a pod with them.
export default function DiscoverDemo() {
  return (
    <main className="px-5 pb-32 pt-4">
      <DemoTopBar current="discover" />

      <h1 className="mt-5 font-serif text-[32px] font-semibold leading-tight text-ink">Pod Neighborhood</h1>
      <p className="mt-1.5 text-[17px] leading-relaxed text-ink-soft">
        Find your people: WHOOP members near you who like what you like. Fitness level and goals don&apos;t
        matter; showing up does.
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-paper-2/70 px-4 py-3">
        <div className="min-w-0">
          <div className="text-[17px] font-semibold text-ink">Let people find me</div>
          <div className="text-[15px] text-muted">First name, age, interests and neighborhood only</div>
        </div>
        <span aria-hidden className="flex h-7 w-12 shrink-0 items-center justify-end rounded-full bg-sage p-0.5">
          <span className="h-6 w-6 rounded-full bg-card shadow" />
        </span>
      </div>

      <FindPeople />

      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        Only members who turn on &ldquo;Let people find me&rdquo; appear. Nothing else is shared until you
        both accept, and Pod never shows an exact location.
      </p>

      <DemoPager current="discover" />
    </main>
  );
}
