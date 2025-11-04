"use client";

import { useMemo } from "react";

import { useUiStore } from "@/lib/store/ui";

import { Button } from "./Button";

const ICONS: Record<string, string> = {
  light: "☀️",
  dark: "🌙",
  system: "⚖️",
};

const LABELS: Record<string, string> = {
  light: "Light theme",
  dark: "Dark theme",
  system: "System theme",
};

export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  const nextLabel = useMemo(() => {
    if (theme === "light") return "Switch to dark theme";
    if (theme === "dark") return "Follow system theme";
    return "Switch to light theme";
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      className="h-9 gap-2 px-3 font-sans text-sm"
    >
      <span aria-hidden className="text-base">
        {ICONS[theme]}
      </span>
      <span className="hidden md:inline">
        {LABELS[theme]}
      </span>
    </Button>
  );
}

