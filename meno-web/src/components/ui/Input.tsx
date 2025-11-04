"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "./cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-[var(--ink)]",
        "placeholder:text-[color-mix(in srgb, var(--muted) 85%, transparent)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";

