import type { Metadata, Viewport } from "next";
import { Lora, Outfit } from "next/font/google";
import { BRAND_NAME } from "@/lib/brand";
import PWARegister from "@/components/PWARegister";
import "./globals.css";

// Heading / display serif. Lora has a clean, upright capital J.
const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
});
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: `${BRAND_NAME} — Fitness with your people`,
  description: "Trusted circles that show up together.",
  manifest: "/manifest.json",
  applicationName: BRAND_NAME,
  appleWebApp: { capable: true, statusBarStyle: "default", title: BRAND_NAME },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a2e1f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${lora.variable} ${outfit.variable}`}>
      <body className="font-sans">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
