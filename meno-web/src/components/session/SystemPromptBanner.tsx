"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { useSessionStore } from "@/lib/store/session";
import { useUiStore } from "@/lib/store/ui";

type BannerVariant = "default" | "returning" | "teacher";

const copyByVariant: Record<BannerVariant, { title: string; body: string; cta: string }> = {
  default: {
    title: "Meno’s Approach",
    body: "I’ll ask you questions to help uncover the reasoning behind each step. You can speak or type your answers, and we’ll work through confusion together.",
    cta: "Let’s begin →",
  },
  returning: {
    title: "Remember the Dialogue",
    body: "Meno won’t just give the answer — it guides you toward it through questions and reflection.",
    cta: "Continue",
  },
  teacher: {
    title: "Socratic Mode Active",
    body: "Meno questions to reveal understanding, not to quiz. Encourage students to narrate their reasoning aloud.",
    cta: "Start session",
  },
};

const resolveVariant = (role: string | null): BannerVariant => {
  if (role === "teacher" || role === "observer") return "teacher";
  return "default";
};

export function SystemPromptBanner() {
  const role = useSessionStore((state) => state.role);
  const phase = useSessionStore((state) => state.phase);
  const bannerDismissed = useUiStore((state) => state.bannerDismissed);
  const dismissBanner = useUiStore((state) => state.dismissBanner);

  const variant = resolveVariant(role);
  const copy = copyByVariant[variant];

  const shouldShow = !bannerDismissed && phase !== "active";

  useEffect(() => {
    if (phase === "active") {
      dismissBanner();
    }
  }, [phase, dismissBanner]);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-6 z-40 flex justify-center px-4">
      <div className="w-[min(92vw,640px)] rounded-3xl border border-[var(--border)] bg-[var(--paper)]/95 px-6 py-6 text-center shadow-strong backdrop-blur">
        <h2 className="font-serif text-2xl text-[var(--ink)]">{copy.title}</h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-[var(--muted)]">{copy.body}</p>
        <div className="mt-4 flex justify-center">
          <Button variant="primary" size="sm" onClick={dismissBanner}>
            {copy.cta}
          </Button>
        </div>
      </div>
    </div>
  );
}

