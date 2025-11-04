import type { OcrExtraction } from "@/lib/ocr/providers";

export interface NormalizedOcrResult {
  canonicalText: string;
  latex?: string;
  plainText: string;
  confidence?: number;
  raw?: unknown;
}

export function normalizeOcrOutput(extraction: OcrExtraction): NormalizedOcrResult {
  const { text, latex, raw } = extraction;
  const { canonical, tex } = pullLatexBlocks(text, latex);

  return {
    canonicalText: canonical,
    latex: tex,
    plainText: canonical.replace(/\s+/g, " ").trim(),
    raw,
  };
}

const latexBlockRegex = /\$\$([\s\S]+?)\$\$|\$([^$]+)\$/g;

function pullLatexBlocks(text: string, explicitLatex?: string) {
  if (explicitLatex) {
    return { canonical: text, tex: explicitLatex };
  }

  const matches: string[] = [];
  let cleaned = text;
  cleaned = cleaned.replace(latexBlockRegex, (_, block, inline) => {
    const latex = block ?? inline;
    if (latex) {
      matches.push(latex.trim());
    }
    return latex ?? "";
  });

  return {
    canonical: cleaned.trim(),
    tex: matches.length > 0 ? matches.join("\n") : undefined,
  };
}

