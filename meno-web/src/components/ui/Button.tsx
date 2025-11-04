"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const baseStyles =
  "inline-flex items-center justify-center rounded-full border transition-colors select-none font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-60";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent hover:brightness-105 active:brightness-95 shadow-soft",
  secondary:
    "bg-[var(--card)] text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--elevated)]",
  ghost:
    "bg-transparent text-[var(--ink)] border-transparent hover:bg-[color-mix(in srgb, var(--ink) 8%, transparent)]",
  danger:
    "bg-[#b94a44] text-white border-transparent hover:brightness-105 active:brightness-95",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-base",
  lg: "h-12 px-5 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "secondary", size = "md", loading, className, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = "Button";

