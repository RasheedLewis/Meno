"use client";

import { cn } from "@/components/ui/cn";

import { Tldraw } from "@tldraw/tldraw";

import "@tldraw/tldraw/tldraw.css";

type WhiteboardProps = {
  className?: string;
};

export function Whiteboard({ className }: WhiteboardProps) {
  return (
    <div className={cn("pointer-events-auto", className)}>
      <Tldraw autoFocus inferDarkMode style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
}
