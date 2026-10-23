import { demoViewer } from "@/lib/demoViewer";
import { buildDemo } from "@/lib/demoPod";
import TodayCard from "@/components/home/TodayCard";
import PodCard from "@/components/home/PodCard";
import YourTurnCard from "@/components/home/YourTurnCard";
import HowItWorks from "@/components/home/HowItWorks";
import RewardsConcept from "@/components/home/RewardsConcept";
import WhoopJoin from "@/components/home/WhoopJoin";
import ShowingUpCard from "@/components/home/ShowingUpCard";
import PodReadiness from "@/components/home/PodReadiness";
import { DemoTopBar, DemoPager } from "@/components/home/DemoNav";
import { NudgeTimeProvider } from "@/components/home/NudgeTime";
import { demoNow } from "@/lib/demoPod";
import { SampleNudgeButton } from "@/components/home/LogButton";
import { NotificationPreview, DemoActions, DemoActionButton } from "@/components/home/DemoParts";

export const dynamic = "force-dynamic";

// A full pod with simulated data, for showing Pod to someone. Same screens as
// the real Home, fed with fixtures instead of the database. Nothing here is
// saved, and nobody else sees it. Step 1 of the demo walkthrough.
export default async function DemoPod() {
  const { firstName, tz } = await demoViewer();
  const demo = buildDemo(tz, firstName);

  return (
    <main className="px-5 pb-32 pt-4">
      <DemoTopBar current="home" />
      <NudgeTimeProvider initialHours={[18]} tz={tz} nowIso={demoNow(tz).toISOString()} demo>

      <NotificationPreview title={demo.notification.title} body={demo.notification.body} />

      <div className="mt-5 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate font-serif text-[28px] font-semibold leading-tight text-ink">
          Evening, {firstName}
        </h1>
        <HowItWorks />
      </div>

      <TodayCard data={demo.today} demo />

      <ShowingUpCard
        score={demo.showingUp.score}
        delta={demo.showingUp.delta}
        weeks={demo.showingUp.weeks}
        podScore={demo.showingUp.podScore}
      />

      <YourTurnCard
        data={demo.yourTurn}
        cta={<SampleNudgeButton title={demo.notification.title} body={demo.notification.body} />}
      />

      <PodReadiness
        podName={demo.pod.name}
        counts={demo.readiness.counts}
        notOnWhoop={demo.readiness.notOnWhoop}
        suggestion={demo.readiness.suggestion}
        action={<DemoActionButton label="Suggest a session tonight, 7 pm" doneLabel="Suggested to the pod ✓" />}
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
        bonus={demo.rewards.bonus}
      />

      {/* A pod-mate without WHOOP: the acquisition side of the same loop. */}
      <section className="mt-8">
        <h2 className="font-serif text-[22px] font-semibold leading-tight text-ink">
          Sam isn't on WHOOP yet
        </h2>
        <p className="mt-1 text-[16px] leading-relaxed text-ink-soft">
          His rings stay empty until he joins. This is what his Home offers him.
        </p>
        <div className="mt-3 rounded-[28px] bg-ink p-4 shadow-pod-lg">
          <WhoopJoin offer demo />
        </div>
      </section>

      </NudgeTimeProvider>

      <p className="mt-6 text-center text-[14px] leading-relaxed text-muted">
        Names, scores and rewards here are made up to show how Pod works.
        <br />
        Pod isn't affiliated with or endorsed by WHOOP.
      </p>
      <DemoPager current="home" />
    </main>
  );
}
