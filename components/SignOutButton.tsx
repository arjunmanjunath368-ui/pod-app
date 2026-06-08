"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      className="w-full rounded-2xl border border-line bg-card py-3.5 text-[15px] font-semibold text-terra transition active:scale-[0.99]"
    >
      Sign out
    </button>
  );
}
