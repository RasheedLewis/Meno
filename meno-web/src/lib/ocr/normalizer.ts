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

const latexBlockRegex = /\$\$([\s\S]+?)\$\$|\$([^$]+)\$/g;

function pullLatexBlocks(text: string, explicitLatex?: string) {
  if (explicitLatex) {
    return { canonical: text, tex: explicitLatex };
  }

  const matches: string[] = [];
  const segments: Array<{ id: string; content: string; display?: boolean }> = [];
  let cleaned = text;
  cleaned = cleaned.replace(latexBlockRegex, (_, block, inline) => {
    const latex = block ?? inline;
    if (latex) {
      matches.push(latex.trim());
      segments.push({
        id: `inline-${segments.length + 1}`,
        content: latex.trim(),
        display: Boolean(block),
      });
    }
    return latex ?? "";
  });

  return {
    canonical: cleaned.trim(),
    tex: matches.length > 0 ? matches.join("\n") : undefined,
    segments,
  };
}

