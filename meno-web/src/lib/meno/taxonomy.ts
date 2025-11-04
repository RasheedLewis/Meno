import type { HspStep, TaxonomyKey } from "@/lib/hsp/schema";

export interface TaxonomyDefinition {
  key: TaxonomyKey;
  label: string;
  description: string;
  signaturePhrases: string[];
  keywords: string[];
  exemplar: string;
}

export interface TaxonomyClassification {
  key: TaxonomyKey;
  confidence: number;
  reasons: string[];
  definition: TaxonomyDefinition;
}

const TAXONOMY: Record<TaxonomyKey, TaxonomyDefinition> = {
  definitional: {
    key: "definitional",
    label: "Definitional",
    description: "Clarifies meaning, symbols, or fundamental properties before proceeding.",
    signaturePhrases: ["what is", "define", "meaning of", "represents"],
    keywords: ["definition", "naming", "meaning", "identity"],
    exemplar: "What does it mean for two triangles to be congruent?",
  },
  analytical: {
    key: "analytical",
    label: "Analytical",
    description: "Examines structure, decomposition, or logical relationships among elements.",
    signaturePhrases: ["how does", "break down", "why", "structure", "relate"],
    keywords: ["analysis", "structure", "relationship", "compare"],
    exemplar: "How does multiplying both sides by the reciprocal change the equation?",
  },
  proportional: {
    key: "proportional",
    label: "Proportional",
    description: "Explores ratios, scaling, variation, or multiplicative comparisons.",
    signaturePhrases: ["ratio", "scale", "proportion", "per", "multiple", "constant"],
    keywords: ["ratio", "rate", "scale", "variation", "multiple"],
    exemplar: "If the side doubles, how does the area scale?",
  },
  spectral: {
    key: "spectral",
    label: "Spectral",
    description: "Considers extremes, boundaries, limiting behavior, or alternate cases.",
    signaturePhrases: ["what happens if", "at the extremes", "limit", "zero", "infinite", "case"],
    keywords: ["extreme", "boundary", "limit", "edge", "alternate"],
    exemplar: "What if the angle shrinks all the way to zero degrees?",
  },
  evaluative: {
    key: "evaluative",
    label: "Evaluative",
    description: "Judges validity, efficiency, or appropriateness of a strategy or result.",
    signaturePhrases: ["is this", "should we", "better", "justify", "valid", "efficient"],
    keywords: ["evaluate", "justify", "decide", "assess", "critique"],
    exemplar: "Is this approach the most efficient way to isolate the variable?",
  },
};

const KEYWORDS = Object.fromEntries(
  Object.entries(TAXONOMY).map(([key, value]) => [key, new Set([...value.keywords, ...value.signaturePhrases])]),
);

export const classifyStepTaxonomy = (step: HspStep | null): TaxonomyClassification => {
  if (!step) {
    return buildClassification("definitional", 0, ["No step supplied"], TAXONOMY.definitional);
  }

  if (step.taxonomy && TAXONOMY[step.taxonomy]) {
    return buildClassification(step.taxonomy, 1, ["Step specified taxonomy"], TAXONOMY[step.taxonomy]);
  }

  const prompt = step.prompt.toLowerCase();
  const hints = (step.hints ?? []).join(" \n ").toLowerCase();
  const tags = (step.tags ?? []).map((tag) => tag.toLowerCase());

  let best: TaxonomyClassification | null = null;

  (Object.keys(TAXONOMY) as TaxonomyKey[]).forEach((key) => {
    const definition = TAXONOMY[key];
    const reasons: string[] = [];
    let score = 0;

    if (tags.some((tag) => tag.includes(key))) {
      score += 2;
      reasons.push(`tag matched '${key}'`);
    }

    const keywordHit = countMatches(prompt, KEYWORDS[key]);
    const hintHit = countMatches(hints, KEYWORDS[key]);
    if (keywordHit > 0) {
      score += keywordHit * 0.6;
      reasons.push(`${keywordHit} prompt keyword match`);
    }
    if (hintHit > 0) {
      score += hintHit * 0.4;
      reasons.push(`${hintHit} hint keyword match`);
    }

    if (!best || score > best.confidence) {
      best = buildClassification(key, score, reasons, definition);
    }
  });

  return best ?? buildClassification("definitional", 0, ["Fell back to default"], TAXONOMY.definitional);
};

const countMatches = (text: string, candidates: Set<string>) => {
  let total = 0;
  candidates.forEach((candidate) => {
    if (candidate && text.includes(candidate)) {
      total += 1;
    }
  });
  return total;
};

const buildClassification = (
  key: TaxonomyKey,
  score: number,
  reasons: string[],
  definition: TaxonomyDefinition,
): TaxonomyClassification => ({
  key,
  confidence: Math.min(1, Math.max(0, score / 3)),
  reasons,
  definition,
});

export const TAXONOMY_ORDER: TaxonomyKey[] = [
  "definitional",
  "analytical",
  "proportional",
  "spectral",
  "evaluative",
];

export const taxonomyDefinitions = TAXONOMY;

