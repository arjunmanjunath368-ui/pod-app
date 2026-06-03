import Link from "next/link";

// Create-or-join chooser shown when a signed-in user has no pod yet.
export default function StartPage() {
  return (
    <div className="flex flex-1 flex-col justify-center px-7 py-12">
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
        🫛 Welcome
      </div>
      <h1 className="font-serif text-[28px] font-semibold leading-[1.15] text-ink">
        Let's get you
        <br />
        in a pod.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        A pod is a small, trusted circle — family, friends, colleagues — who
        each chase their own goal and stay consistent together.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <Link
          href="/app/start/create"
          className="rounded-3xl bg-terra p-6 text-paper shadow-pod-lg transition active:scale-[0.99]"
        >
          <div className="text-[22px]">🌱</div>
          <div className="mt-2 font-serif text-[20px] font-semibold">
            Start a new pod
          </div>
          <div className="mt-1 text-[15px] text-paper/80">
            You'll get an invite code to share with your people.
          </div>
        </Link>

        <Link
          href="/app/start/join"
          className="rounded-3xl border border-line bg-card p-6 shadow-pod transition active:scale-[0.99]"
        >
          <div className="text-[22px]">🤝</div>
          <div className="mt-2 font-serif text-[20px] font-semibold text-ink">
            Join with a code
          </div>
          <div className="mt-1 text-[15px] text-muted">
            Someone already started a pod and sent you a code.
          </div>
        </Link>
      </div>
    </div>
  );
}
