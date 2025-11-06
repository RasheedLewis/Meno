"use client";

import { cn } from "@/components/ui/cn";

import { Tldraw } from "@tldraw/tldraw";

import "@tldraw/tldraw/tldraw.css";

type WhiteboardProps = {
  className?: string;
};

export function Whiteboard({ className }: WhiteboardProps) {
  return (
    <div className={cn("pointer-events-auto h-full w-full", className)}>
      <Tldraw autoFocus inferDarkMode />
    </div>
  );
}
