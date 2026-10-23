import { createClient } from "@/lib/supabase/server";

// Who's viewing the demo: their first name and their pod's time zone, so the
// demo greets them and its dates match their week.
export async function demoViewer() {
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
  return { firstName, tz };
}

