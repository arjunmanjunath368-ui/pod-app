import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildDemo } from "@/lib/demoPod";
import TodayCard from "@/components/home/TodayCard";
import PodCard from "@/components/home/PodCard";
import YourTurnCard from "@/components/home/YourTurnCard";
import HowItWorks from "@/components/home/HowItWorks";
import RewardsConcept from "@/components/home/RewardsConcept";
import WhoopJoin from "@/components/home/WhoopJoin";
import { SampleNudgeButton } from "@/components/home/LogButton";
import { NotificationPreview, DemoActions } from "@/components/home/DemoParts";

export const dynamic = "force-dynamic";

// A full pod with simulated data, for showing Pod to someone. Same screens as
// the real Home, fed with fixtures instead of the database. Nothing here is
// saved, and nobody else sees it.
export default async function DemoPod() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let firstName = "You";
  let tz = "America/New_York";
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    firstName = ((prof?.display_name as string | null) ?? "You").split(/\s+/)[0];
    const { data: mem } = await supabase
      .from("pod_members")
      .select("pods(timezone)")
      .eq("user_id", user.id)
      .neq("status", "left")
      .limit(1);
    const p = (mem ?? [])[0] as any;
    const podTz = (Array.isArray(p?.pods) ? p.pods[0] : p?.pods)?.timezone;
    if (podTz) tz = podTz;
  }

  const demo = buildDemo(tz, firstName);

  return (
    <main className="px-5 pb-16 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/app" className="text-[14px] font-semibold text-muted active:scale-95">
          ‹ My pods
        </Link>
        <span className="rounded-full bg-gold/[0.18] px-3 py-1 text-[12px] font-semibold text-ink">
          Demo pod · simulated data
        </span>
      </div>

      <NotificationPreview title={demo.notification.title} body={demo.notification.body} />

      <div className="mt-5 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate font-serif text-[28px] font-semibold leading-tight text-ink">
          Evening, {firstName}
        </h1>
        <HowItWorks />
      </div>

      <TodayCard data={demo.today} demo />

      <YourTurnCard
        data={demo.yourTurn}
        cta={<SampleNudgeButton title={demo.notification.title} body={demo.notification.body} />}
      />

      <PodCard
        pod={demo.pod}
        renderActions={(m) => (m.canNudge ? <DemoActions name={m.name} /> : null)}
      />

      <RewardsConcept
        perfectWeeks={demo.rewards.perfectWeeks}
        goal={demo.rewards.goal}
        pointsPerWeek={demo.rewards.pointsPerWeek}
        remaining={demo.pod.remaining}
        whoopMembers={demo.rewards.whoopMembers}
      />

      {/* A pod-mate without WHOOP: the acquisition side of the same loop. */}
      <section className="mt-8">
        <h2 className="font-serif text-[22px] font-semibold leading-tight text-ink">
          Sam isn't on WHOOP yet
        </h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
          His rings stay empty until he joins. This is what his Home offers him.
        </p>
        <div className="mt-3 rounded-[28px] bg-ink p-4 shadow-pod-lg">
          <WhoopJoin offer demo />
        </div>
      </section>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-muted">
        Names, scores and rewards here are made up to show how Pod works.
        <br />
        Pod isn't affiliated with or endorsed by WHOOP.
      </p>
    </main>
  );
}
