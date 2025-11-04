"use client";

import { useEffect, useCallback } from "react";

import { getResolvedTheme, useUiStore } from "@/lib/store/ui";

const applyThemeToRoot = (theme: "light" | "dark") => {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
};

export function ThemeWatcher() {
  const theme = useUiStore((state) => state.theme);

  const applyTheme = useCallback(() => {
    const resolved = getResolvedTheme(theme);
    applyThemeToRoot(resolved as "light" | "dark");
  }, [theme]);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme();
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme, applyTheme]);

  return null;
}

