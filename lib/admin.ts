// Who may open the private admin pages. Controlled by the ADMIN_EMAILS env var
// in Vercel (comma-separated). If the variable is missing or empty, NOBODY is
// an admin — it fails closed rather than open.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? "";
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  return allowed.indexOf(email.trim().toLowerCase()) !== -1;
}
