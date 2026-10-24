import { DemoTopBar, DemoPager } from "@/components/home/DemoNav";
import FamilyView from "@/components/home/FamilyView";

export const dynamic = "force-dynamic";

// Demo: Core (your closest people) share more than a pod does, metric by
// metric, with both people's consent. Simulated.
export default function FamilyDemo() {
  return (
    <main className="px-5 pb-32 pt-4">
      <DemoTopBar current="family" />

      <h1 className="mt-5 font-serif text-[32px] font-semibold leading-tight text-ink">Core</h1>
      <p className="mt-1.5 text-[17px] leading-relaxed text-ink-soft">
        The few people closest to you: a partner, a parent, a sibling, a best friend. They see more than your pod,
        and each of you chooses what to share.
      </p>

      <FamilyView />

      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        Sharing starts only when both of you accept, and is never shown to your pods.
      </p>

      <DemoPager current="family" />
    </main>
  );
}
