import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Privacy policy · ${BRAND_NAME}` };

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 font-serif text-[20px] font-semibold text-ink">
    {children}
  </h2>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{children}</p>
);
const UL = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-soft">
    {items.map((it, i) => (
      <li key={i}>{it}</li>
    ))}
  </ul>
);

// Public on purpose (outside /app, so no login is needed to read it).
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[640px] px-5 pb-20 pt-10">
      <Link href="/" className="text-[14px] font-semibold text-muted">
        ‹ Back to {BRAND_NAME}
      </Link>
      <h1 className="mt-4 font-serif text-[30px] font-semibold leading-tight text-ink">
        Privacy policy
      </h1>
      <p className="mt-1 text-[13px] text-muted">Last updated: October 5, 2026</p>

      <P>
        {BRAND_NAME} is a small-group fitness accountability app. This page
        explains, in plain language, what {BRAND_NAME} collects, how it's used
        and shared, and the choices you have.
      </P>

      <H>1. What we collect</H>
      <UL
        items={[
          "Your account: your email address (to send your sign-in link), your display name, and an optional profile photo.",
          "Your activity: your weekly goal, the workouts you log (activity type, time, notes, and any photos you take or add), personal bests, and the reactions, comments, challenges and nudges you send.",
          "Stakes, only if your pod uses them: amounts, who agreed, and weekly results. Pod keeps track of who owes what. It does not hold or move money.",
          "Notifications, only if you turn them on: your device's push address, so we can send them.",
          "Synced workouts, only if you connect Apple Health or WHOOP (sections 3 and 4).",
        ]}
      />
      <P>
        We do not collect your location, and we do not use advertising or
        third-party analytics trackers.
      </P>

      <H>2. Who can see what</H>
      <P>
        The members of a pod can see what you post in that pod: your goal and
        progress, and the workouts, notes, photos, reactions and comments you
        add. Nothing is public outside your pods. The people who run{" "}
        {BRAND_NAME} can access data as needed to operate, support and improve
        the service.
      </P>

      <H>3. Apple Health (optional)</H>
      <P>
        If you turn on Apple Health auto-logging, a companion app on your phone
        sends your finished workouts to {BRAND_NAME} (type, time, length and,
        if you enable it there, energy burned). They appear in your pods marked
        as synced, and they never count toward stakes. You can turn this off
        in Settings at any time.
      </P>

      <H>4. WHOOP (optional)</H>
      <UL
        items={[
          "What we ask WHOOP for: your workouts, and your WHOOP user ID, which we use only to match WHOOP's notifications to your account. We do not store your WHOOP name or email.",
          "What we keep: for each workout, only the activity type, start time and length. We do not store strain, heart rate, calories, recovery or sleep.",
          "Your consent: before connecting, you explicitly agree that workouts synced from WHOOP will be visible to the members of your pods.",
          "Stakes: synced workouts never count toward stakes.",
          "Security: your WHOOP access tokens are encrypted before they are stored and can't be read from the app.",
          "Your control: in Settings you can disconnect at any time. We then revoke our access at WHOOP, delete our stored tokens, and, if you choose, remove your WHOOP-synced workouts from your pods. You can also revoke access from inside the WHOOP app. If you delete a workout in WHOOP, it is removed from your pods too.",
          "We do not sell WHOOP data, use it for advertising, or use it to train AI models.",
        ]}
      />
      <P>{BRAND_NAME} is not affiliated with or endorsed by WHOOP.</P>

      <H>5. How we use information</H>
      <P>
        To run {BRAND_NAME}: to show your pods your activity, work out goals,
        streaks and stakes, send the notifications you've enabled, keep the
        service secure, and fix problems. We do not sell your information, use
        it for advertising, or use it to train AI models.
      </P>

      <H>6. Service providers</H>
      <P>
        We use Supabase (database, file storage and sign-in emails) and Vercel
        (hosting) to run {BRAND_NAME}, and your browser or phone's push
        notification service delivers notifications you turn on. They handle
        data only on our behalf. We don't share your information with anyone
        else, except where the law requires it.
      </P>

      <H>7. Keeping and deleting your data</H>
      <P>
        We keep your information while your account is active. You can edit or
        delete your logs in the app. To delete your account and the data tied
        to it, email hello@podfitt.com and we'll do it within 30 days.
      </P>

      <H>8. Security</H>
      <P>
        Data travels over HTTPS, access is restricted, and our database
        provider encrypts stored data. No system is perfectly secure, but we
        take reasonable steps to protect your information.
      </P>

      <H>9. Children</H>
      <P>
        {BRAND_NAME} is not directed to children under 13, and we don't
        knowingly collect their information.
      </P>

      <H>10. Changes</H>
      <P>
        If we change this policy we'll update the date above, and we'll tell
        you in the app if the change is significant.
      </P>

      <H>11. Contact</H>
      <P>Questions or requests: hello@podfitt.com</P>
    </main>
  );
}
