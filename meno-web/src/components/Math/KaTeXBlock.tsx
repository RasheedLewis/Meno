"use client";

import { useEffect, useRef } from "react";
import katex from "katex";

import "katex/dist/katex.min.css";

export interface KaTeXBlockProps {
  expression: string;
  inline?: boolean;
  displayMode?: boolean;
  errorColor?: string;
  className?: string;
}

export function KaTeXBlock({
  expression,
  inline,
  displayMode,
  errorColor = "#b94a44",
  className,
}: KaTeXBlockProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const isInline = inline ?? !displayMode;

  useEffect(() => {
    const element = isInline ? spanRef.current : blockRef.current;
    if (!element) return;

    try {
      katex.render(expression, element, {
        throwOnError: false,
        displayMode: !isInline,
        errorColor,
      });
    } catch (error) {
      console.error("KaTeX render error", error);
      element.innerHTML = `<code class="katex-error">${escapeHtml(expression)}</code>`;
    }
  }, [expression, errorColor, isInline]);

  if (isInline) {
    return <span ref={spanRef} className={className} suppressHydrationWarning />;
  }

  return <div ref={blockRef} className={className} suppressHydrationWarning />;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

