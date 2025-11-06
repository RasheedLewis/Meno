"use client";

import { useMemo } from "react";

import { cn } from "@/components/ui/cn";

import {
  Tldraw,
  type TldrawUiOverrides,
} from "@tldraw/tldraw";

import "@tldraw/tldraw/dist/tldraw.css";

type WhiteboardProps = {
  className?: string;
};

const MINIMAL_TOOLS = ["select", "draw", "geo", "eraser"] as const;
type MinimalToolId = (typeof MINIMAL_TOOLS)[number];

export function Whiteboard({ className }: WhiteboardProps) {
  const overrides = useMemo<TldrawUiOverrides>(() => {
    return {
      toolbar: (_editor, toolbar) =>
        toolbar.filter((item) => MINIMAL_TOOLS.includes(item.id as MinimalToolId)),
      keyboardShortcutsMenu: () => [],
      actionsMenu: () => [],
      quickActions: () => [],
      helpMenu: () => [],
    } satisfies TldrawUiOverrides;
  }, []);

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--paper)]", className)}>
      <Tldraw
        autoFocus
        inferDarkMode
        showGrid
        showPages={false}
        showMenu={false}
        showSponsorLink={false}
        showMultiplayerMenu={false}
        uiOverrides={overrides}
      />
    </div>
  );
}
