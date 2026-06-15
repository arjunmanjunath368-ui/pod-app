import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import RefreshOnFocus from "@/components/RefreshOnFocus";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="phone">
      <RefreshOnFocus />
      {children}
      <PWAInstallPrompt />
    </div>
  );
}
