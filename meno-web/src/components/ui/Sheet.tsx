"use client";

import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

import { cn } from "./cn";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  children: ReactNode;
  widthClass?: string;
  className?: string;
}

export function Sheet({
  open,
  onClose,
  side = "right",
  children,
  widthClass = "w-[360px]",
  className,
}: SheetProps) {
  const portalTarget =
    typeof document === "undefined" ? null : (document.body as HTMLElement);

  useEffect(() => {
    if (!open || !portalTarget) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose, portalTarget]);

  if (!open || !portalTarget) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside
        className={cn(
          "absolute top-0 flex h-full flex-col border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] shadow-strong",
          side === "right" ? "right-0" : "left-0",
          widthClass,
          className,
        )}
      >
        {children}
      </aside>
    </div>,
    portalTarget,
  );
}

