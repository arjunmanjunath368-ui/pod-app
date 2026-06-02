import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import CodeActions from "@/components/CodeActions";

// Gate: no pod yet -> /app/start. Otherwise a placeholder Home
// (the real pod card + member rows arrive in chunk 4).
export default async function AppHome() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("pod_members")
    .select("pod_id, role, pods(name, invite_code, max_members)")
    .eq("user_id", user.id)
    .neq("status", "left");

  if (!memberships || memberships.length === 0) redirect("/app/start");

  return (
    <div className="flex-1 px-6 py-10">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        🫛 You're in
      </div>
      <h1 className="font-serif text-[26px] font-semibold text-ink">
        Your pods
      </h1>

      <div className="mt-6 flex flex-col gap-3">
        {memberships.map((m) => {
          const pod = Array.isArray(m.pods) ? m.pods[0] : m.pods;
          return (
            <div
              key={m.pod_id}
              className="rounded-3xl bg-ink p-6 text-paper shadow-pod-lg"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sage-soft">
                {m.role === "owner" ? "You started this pod" : "Member"}
              </div>
              <h2 className="mt-1 font-serif text-[22px] font-semibold">
                {pod?.name}
              </h2>
              <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-sage-soft">
                  Invite code
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="font-serif text-[24px] font-semibold tracking-[0.18em] text-gold">
                    {pod?.invite_code}
                  </div>
                  <CodeActions
                    code={pod?.invite_code ?? ""}
                    podName={pod?.name ?? "our pod"}
                  />
                </div>
              </div>
              <p className="mt-3 text-[12.5px] text-sage-soft">
                Share this code so your people can join. Up to{" "}
                {pod?.max_members} in this pod.
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-line bg-card p-5 text-[13px] leading-relaxed text-muted">
        <b className="text-ink">Next up:</b> set your weekly goal and log your
        first session. That screen lands in the next build chunk — for now the
        plumbing (auth, pods, invites) is live.
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Link
          href="/app/start/join"
          className="text-[13px] font-semibold text-terra"
        >
          Join another pod
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}
