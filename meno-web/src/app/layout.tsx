import type { Metadata } from "next";
import { EB_Garamond, Inter } from "next/font/google";

import { PresenceOverlay } from "@/components/Presence/PresenceOverlay";
import { SystemPromptBanner } from "@/components/session/SystemPromptBanner";
import { ThemeWatcher } from "@/components/system/ThemeWatcher";
import { ToastViewport } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";

import "./globals.css";

const garamond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-garamond",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meno — Socratic Math Tutor",
  description:
    "An AI tutor that guides students through mathematics via Socratic dialogue and collaboration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${garamond.variable} ${inter.variable}`}
    >
      <body
        className={cn(
          "relative min-h-screen font-serif bg-[var(--bg)] text-[var(--fg)] antialiased",
          inter.variable,
          garamond.variable,
        )}
      >
        <ThemeWatcher />
        <PresenceOverlay className="pointer-events-none" />
        <SystemPromptBanner />
        <ToastViewport />
        <div className="relative flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
