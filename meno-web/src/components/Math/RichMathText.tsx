"use client";

import { Fragment } from "react";

import { KaTeXBlock } from "@/components/Math/KaTeXBlock";
import { cn } from "@/components/ui/cn";

interface RichMathTextProps {
  text: string;
  className?: string;
}

const mathRegex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$]+?)\$/g;

export function RichMathText({ text, className }: RichMathTextProps) {
  const segments = [] as Array<
    | { type: "text"; value: string }
    | { type: "math"; value: string; display: boolean }
  >;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(text)) !== null) {
    const [fullMatch, displayDollar, displayBracket, inlineParen, inlineDollar] = match;
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
    }

    const mathValue = (displayDollar ?? displayBracket ?? inlineParen ?? inlineDollar ?? "").trim();
    segments.push({ type: "math", value: mathValue, display: Boolean(displayDollar ?? displayBracket) });

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-1", className)}>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {segment.type === "text" ? renderTextSegment(segment.value) : renderMathSegment(segment)}
        </Fragment>
      ))}
    </span>
  );
}

const renderTextSegment = (value: string) => {
  const parts = value.split(/(\n)/g);
  return parts.map((part, idx) =>
    part === "\n" ? <br key={idx} /> : <span key={idx}>{part}</span>,
  );
};

const renderMathSegment = (segment: { value: string; display: boolean }) => (
  <KaTeXBlock
    expression={segment.value}
    inline={!segment.display}
    displayMode={segment.display}
    className={segment.display ? "w-full" : undefined}
  />
);

