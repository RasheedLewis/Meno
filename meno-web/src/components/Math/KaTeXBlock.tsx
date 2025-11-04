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
  const spanRef = useRef<HTMLSpanElement | HTMLDivElement>(null);
  const isInline = inline ?? !displayMode;

  useEffect(() => {
    const element = spanRef.current;
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

  const Element = isInline ? "span" : "div";

  return <Element ref={spanRef} className={className} suppressHydrationWarning />;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

