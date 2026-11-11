import type { Metadata, Viewport } from "next";
import { Lilita_One, Nunito } from "next/font/google";
import "./globals.css";

const display = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Nunito({ weight: ["600", "700", "800", "900"], subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Stick Party",
  description: "Team stickman mini-games on your phones",
  appleWebApp: { capable: true, title: "Stick Party", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2a1650",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
