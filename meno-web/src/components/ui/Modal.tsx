"use client";

import { type ReactNode, useEffect, useId } from "react";
import { createPortal } from "react-dom";

import { cn } from "./cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  description,
  footer,
  className,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
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
    <div
      role="dialog"
      aria-modal
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-0 z-50 grid place-items-center"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-[min(92vw,640px)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] shadow-strong",
          className,
        )}
      >
        {(title || description) && (
          <header className="border-b border-[var(--border)] bg-[var(--paper)]/70 px-6 py-5">
            {title && (
              <h2 id={titleId} className="font-serif text-2xl text-[var(--ink)]">
                {title}
              </h2>
            )}
            {description && (
              <p
                id={descriptionId}
                className="mt-2 font-sans text-sm text-[var(--muted)]"
              >
                {description}
              </p>
            )}
          </header>
        )}
        <div className="px-6 py-5 font-sans text-[var(--ink)]">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--paper)]/70 px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    portalTarget,
  );
}

