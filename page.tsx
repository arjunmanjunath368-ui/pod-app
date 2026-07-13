import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// If already signed in, go straight to the app; otherwise to login.
// (The middleware normally handles this; this is a safe backstop.)
export default async function Index() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/app" : "/login");
}
