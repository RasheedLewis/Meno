"use client";

import { useEffect, useState } from "react";

import { cn } from "@/components/ui/cn";
import { randomId } from "@/lib/utils/random";

export interface ToastMessage {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error";
  duration?: number;
}

let listeners: Array<(message: ToastMessage | null) => void> = [];

export function showToast(message: Omit<ToastMessage, "id"> & { id?: string }) {
  const payload: ToastMessage = {
    id: message.id ?? randomId("toast"),
    duration: message.duration ?? 3000,
    variant: message.variant ?? "default",
    ...message,
  };
  listeners.forEach((listener) => listener(payload));
}

export function ToastViewport() {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    const listener = (message: ToastMessage | null) => {
      setToast(message);
      if (message?.duration) {
        const timer = window.setTimeout(() => setToast(null), message.duration);
        return () => window.clearTimeout(timer);
      }
      return undefined;
    };

    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (!toast) return null;

  const tone = toast.variant === "success"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
    : toast.variant === "error"
    ? "border-[#b94a44]/40 bg-[#b94a44]/10 text-[#b94a44]"
    : "border-[var(--border)] bg-[var(--paper)]/95 text-[var(--ink)]";

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-start justify-center px-4 pt-6">
      <div
        className={cn(
          "pointer-events-auto flex max-w-sm flex-col gap-1 rounded-2xl border px-4 py-3 shadow-strong",
          tone,
        )}
      >
        {toast.title ? <p className="font-semibold">{toast.title}</p> : null}
        {toast.description ? (
          <p className="text-sm text-[var(--muted)]">{toast.description}</p>
        ) : null}
      </div>
    </div>
  );
}

