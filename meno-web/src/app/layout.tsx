import type { Metadata } from "next";
import { EB_Garamond, Inter } from "next/font/google";

import { PresenceOverlay } from "@/components/Presence/PresenceOverlay";
import { SystemPromptBanner } from "@/components/session/SystemPromptBanner";
import { ThemeWatcher } from "@/components/system/ThemeWatcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
          <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium uppercase tracking-[0.3em] text-accent/80">
                Guided by Questions
              </span>
              <h1 className="text-4xl font-semibold leading-tight text-ink">
                Meno
              </h1>
              <p className="font-sans text-lg text-muted">
                The classical Socratic tutor for mathematics.
              </p>
            </div>
            <div className="flex items-center justify-end">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 rounded-2xl border border-[var(--border)] bg-paper/95 p-8 shadow-sm">
            {children}
          </main>
          <footer className="flex flex-col gap-1 pb-4 pt-2 font-sans text-sm text-muted">
            <span>Inspired by Plato’s dialogue.</span>
            <span>© {new Date().getFullYear()} Project Meno.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
