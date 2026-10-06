import { BRAND_MARK, BRAND_NAME } from "@/lib/brand";
import PrivacyClose from "@/components/PrivacyClose";

export const metadata = { title: `Privacy policy · ${BRAND_NAME}` };

type Section = {
  title: string;
  optional?: boolean;
  paragraphs?: string[];
  bullets?: string[];
  after?: string[]; // paragraphs shown below the bullets
};

// The policy text lives here as data so the wording is easy to review in one place.
const SECTIONS: Section[] = [
  {
    title: "What we collect",
    bullets: [
      "Your account: your email address (to send your sign-in link), your display name, and an optional profile photo.",
      "Your activity: your weekly goal, the workouts you log (activity type, time, notes, and any photos you take or add), personal bests, and the reactions, comments, challenges and nudges you send.",
      "Stakes (cash or a meal), only if your pod uses them: the amount or treat, who agreed, and weekly results. Pod keeps track of who owes what. It does not hold or move money.",
      "Notifications, only if you turn them on: your device's push address, so we can send them.",
      "Synced workouts, only if you connect Apple Health or WHOOP (sections 3 and 4).",
    ],
    after: [
      "We do not collect your location, and we do not use advertising or third-party analytics trackers.",
    ],
  },
  {
    title: "Who can see what",
    paragraphs: [
      `The members of a pod can see what you post in that pod: your goal and progress, and the workouts, notes, photos, reactions and comments you add. Nothing is public outside your pods. The people who run ${BRAND_NAME} can access data as needed to operate, support and improve the service.`,
    ],
  },
  {
    title: "Apple Health",
    optional: true,
    paragraphs: [
      `If you turn on Apple Health auto-logging, a companion app on your phone sends your finished workouts to ${BRAND_NAME} (type, time, length and, if you enable it there, energy burned). They appear in your pods marked as synced, and they never count toward stakes. You can turn this off in Settings at any time.`,
    ],
  },
  {
    title: "WHOOP",
    optional: true,
    bullets: [
      "What we ask WHOOP for: your workouts, and your WHOOP user ID, which we use only to match WHOOP's notifications to your account. We do not store your WHOOP name or email.",
      "What we keep: for each workout, only the activity type, start time and length. We do not store strain, heart rate, calories, recovery or sleep.",
      "Your consent: before connecting, you explicitly agree that workouts synced from WHOOP will be visible to the members of your pods.",
      "Stakes: synced workouts never count toward stakes.",
      "Security: your WHOOP access tokens are encrypted before they are stored and can't be read from the app.",
      "Your control: in Settings you can disconnect at any time. We then revoke our access at WHOOP, delete our stored tokens, and, if you choose, remove your WHOOP-synced workouts from your pods. You can also revoke access from inside the WHOOP app. If you delete a workout in WHOOP, it is removed from your pods too.",
      "We do not sell WHOOP data, use it for advertising, or use it to train AI models.",
    ],
    after: [`${BRAND_NAME} is not affiliated with or endorsed by WHOOP.`],
  },
  {
    title: "How we use information",
    paragraphs: [
      `To run ${BRAND_NAME}: to show your pods your activity, work out goals, streaks and stakes, send the notifications you've enabled, keep the service secure, and fix problems. We do not sell your information, use it for advertising, or use it to train AI models.`,
    ],
  },
  {
    title: "Service providers",
    paragraphs: [
      `We use Supabase (database, file storage and sign-in emails) and Vercel (hosting) to run ${BRAND_NAME}, and your browser or phone's push notification service delivers notifications you turn on. They handle data only on our behalf. We don't share your information with anyone else, except where the law requires it.`,
    ],
  },
  {
    title: "Keeping and deleting your data",
    paragraphs: [
      "We keep your information while your account is active. You can edit or delete your logs in the app. To delete your account and the data tied to it, email hello@podfitt.com and we'll do it within 30 days.",
    ],
  },
  {
    title: "Security",
    paragraphs: [
      "Data travels over HTTPS, access is restricted, and our database provider encrypts stored data. No system is perfectly secure, but we take reasonable steps to protect your information.",
    ],
  },
  {
    title: "Children",
    paragraphs: [
      `${BRAND_NAME} is not directed to children under 13, and we don't knowingly collect their information.`,
    ],
  },
  {
    title: "Changes",
    paragraphs: [
      "If we change this policy we'll update the date above, and we'll tell you in the app if the change is significant.",
    ],
  },
];

const GLANCE: { icon: string; title: string; text: string }[] = [
  { icon: "👥", title: "Stays in your pods", text: "Nothing is public outside your pods." },
  { icon: "🚫", title: "No ads", text: "No advertising or tracking scripts." },
  { icon: "📍", title: "No location", text: "We don't collect where you are." },
  { icon: "🔒", title: "Never sold", text: "Not sold, not used to train AI." },
];

// Public on purpose (outside /app, so no login is needed to read it). It sits
// inside the same phone shell as the rest of the app, which supplies the cream
// background — without it the page inherits the app's dark-green body colour.
export default function PrivacyPage() {
  return (
    <div className="phone">
      <header className="bg-ink px-5 pb-7 pt-8 text-paper">
        <div className="flex items-start justify-between">
          <div className="text-[30px] leading-none">{BRAND_MARK}</div>
          <PrivacyClose variant="icon" />
        </div>
        <h1 className="mt-4 font-serif text-[32px] font-semibold leading-tight">
          Privacy policy
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-sage-soft">
          Your pod sees your workouts. We never sell your data, show you ads, or
          use it to train AI.
        </p>
        <p className="mt-3 text-[12px] text-paper/60">
          Last updated: October 5, 2026
        </p>
      </header>

      <main className="flex-1 px-5 pb-12 pt-5">
        <div className="grid grid-cols-2 gap-2.5">
          {GLANCE.map((g) => (
            <div
              key={g.title}
              className="rounded-2xl border border-line bg-card p-3.5"
            >
              <div className="text-[22px] leading-none">{g.icon}</div>
              <div className="mt-2 text-[14px] font-semibold text-ink">
                {g.title}
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-muted">
                {g.text}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
          {BRAND_NAME} is a small-group fitness accountability app. This page
          explains, in plain language, what {BRAND_NAME} collects, how it's used
          and shared, and the choices you have.
        </p>

        {SECTIONS.map((s, i) => (
          <section
            key={s.title}
            className={`mt-3 rounded-2xl border p-4 ${
              s.optional
                ? "border-gold/40 bg-gold/[0.07]"
                : "border-line bg-card"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terra text-[13px] font-semibold text-paper">
                {i + 1}
              </span>
              <h2 className="font-serif text-[18px] font-semibold leading-tight text-ink">
                {s.title}
              </h2>
              {s.optional && (
                <span className="ml-auto shrink-0 rounded-full bg-gold/[0.25] px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                  Optional
                </span>
              )}
            </div>
            {s.paragraphs?.map((p) => (
              <p
                key={p}
                className="mt-3 text-[15px] leading-relaxed text-ink-soft"
              >
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft marker:text-terra">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {s.after?.map((p) => (
              <p
                key={p}
                className="mt-3 text-[15px] leading-relaxed text-ink-soft"
              >
                {p}
              </p>
            ))}
          </section>
        ))}

        <section className="mt-3 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terra text-[13px] font-semibold text-paper">
              {SECTIONS.length + 1}
            </span>
            <h2 className="font-serif text-[18px] font-semibold leading-tight text-ink">
              Contact
            </h2>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            Questions or requests:{" "}
            <a
              href="mailto:hello@podfitt.com"
              className="font-semibold text-terra underline"
            >
              hello@podfitt.com
            </a>
          </p>
        </section>

        <PrivacyClose variant="accept" />
      </main>
    </div>
  );
}
