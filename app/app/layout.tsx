// Authed shell. The phone frame; bottom nav arrives in a later chunk
// once Home / Pod / You screens exist.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="phone">{children}</div>;
}
