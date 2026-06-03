import type { Metadata, Viewport } from "next";
import { Lora, Outfit } from "next/font/google";
import { BRAND_NAME } from "@/lib/brand";
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
      <body className="font-sans">{children}</body>
    </html>
  );
}
