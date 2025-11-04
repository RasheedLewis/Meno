import type { OcrExtraction } from "@/lib/ocr/providers";

export interface NormalizedOcrResult {
  canonicalText: string;
  latex?: string;
  plainText: string;
  mathSegments?: Array<{ id: string; content: string; display?: boolean }>;
  confidence?: number;
  raw?: unknown;
}

export function normalizeOcrOutput(extraction: OcrExtraction): NormalizedOcrResult {
  const { text, latex, raw } = extraction;
  const { canonical, tex, segments } = pullLatexBlocks(text, latex);

  return {
    canonicalText: canonical,
    latex: tex,
    plainText: canonical.replace(/\s+/g, " ").trim(),
    mathSegments: segments,
    raw,
  };
}

const latexBlockRegex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$]+?)\$/g;

function pullLatexBlocks(text: string, explicitLatex?: string) {
  if (explicitLatex) {
    return { canonical: text, tex: explicitLatex };
  }

  const matches: string[] = [];
  const segments: Array<{ id: string; content: string; display?: boolean }> = [];
  let cleaned = text;
  cleaned = cleaned.replace(latexBlockRegex, (match, displayBlock, bracketBlock, inlineParen, inlineDollar) => {
    const latex = (displayBlock ?? bracketBlock ?? inlineParen ?? inlineDollar ?? "").trim();
    if (latex) {
      matches.push(latex);
      segments.push({
        id: `inline-${segments.length + 1}`,
        content: latex,
        display: Boolean(displayBlock ?? bracketBlock),
      });
      if (displayBlock) {
        return `$$${latex}$$`;
      }
      if (bracketBlock) {
        return `\\[${latex}\\]`;
      }
      if (inlineParen) {
        return `\\(${latex}\\)`;
      }
      return `$${latex}$`;
    }
    return match;
  });

  return {
    canonical: cleaned.trim(),
    tex: matches.length > 0 ? matches.join("\n") : undefined,
    segments,
  };
}

