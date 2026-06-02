import { redirect } from "next/navigation";

// Middleware sends signed-in users to /app; everyone else lands on login.
export default function Index() {
  redirect("/login");
}
