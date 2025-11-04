import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemePreference = "system" | "light" | "dark";

interface UiState {
  theme: ThemePreference;
  activeModal: string | null;
  activeSheet: string | null;
  bannerDismissed: boolean;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  openSheet: (id: string) => void;
  closeSheet: () => void;
  resetUi: () => void;
  dismissBanner: () => void;
}

const cycleTheme = (theme: ThemePreference): ThemePreference => {
  if (theme === "light") return "dark";
  if (theme === "dark") return "system";
  return "light";
};

const initialState = {
  theme: "system" as ThemePreference,
  activeModal: null,
  activeSheet: null,
  bannerDismissed: false,
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      ...initialState,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: cycleTheme(state.theme) })),
      openModal: (id) => set({ activeModal: id }),
      closeModal: () => set({ activeModal: null }),
      openSheet: (id) => set({ activeSheet: id }),
      closeSheet: () => set({ activeSheet: null }),
      dismissBanner: () => set({ bannerDismissed: true }),
      resetUi: () => set(initialState),
    }),
    {
      name: "meno-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme, bannerDismissed: state.bannerDismissed }),
    },
  ),
);

export const getResolvedTheme = (theme: ThemePreference) => {
  if (typeof window === "undefined") {
    return theme === "system" ? "light" : theme;
  }
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
};

