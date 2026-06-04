import PWAInstallPrompt from "@/components/PWAInstallPrompt";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="phone">
      {children}
      <PWAInstallPrompt />
    </div>
  );
}
