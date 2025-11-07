"use client";

import { cn } from "@/components/ui/cn";
import { useMemo } from "react";

import {
  Tldraw,
  type TLUiOverrides,
} from "@tldraw/tldraw";

import "@tldraw/tldraw/tldraw.css";

type WhiteboardProps = {
  className?: string;
};

export function Whiteboard({ className }: WhiteboardProps) {
  const overrides = useMemo<TLUiOverrides>(
    () => ({
      toolbar: (editor, toolbar) => toolbar,
      stylePanel: () => null,
      helperButtons: () => null,
      contextMenu: () => null,
      quickActions: () => [],
      actionsMenu: () => [],
      helpMenu: () => [],
    }),
    [],
  );

  return (
    <div className={cn("pointer-events-auto h-full w-full bg-[var(--paper)]", className)}>
      <Tldraw autoFocus inferDarkMode overrides={overrides} />
    </div>
  );
}
