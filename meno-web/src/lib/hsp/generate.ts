import { env } from "@/env";
import { normalizeId } from "@/lib/utils/id";
import type { GenerateHspInput, HspPlan, HspStep, TaxonomyKey } from "./schema";

const MODEL = "gpt-4.1-mini";

export async function generateHiddenSolutionPlan(input: GenerateHspInput): Promise<HspPlan> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to generate HSP");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(input),
            },
          ],
        },
      ],
      max_output_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to generate HSP: ${response.status} ${message}`);
  }

  const payload = (await response.json()) as OpenAIResponse;
  const json = extractJson(payload);

  const planId = json.id ?? normalizeId(`${input.problemId}-${Date.now()}`);
  const createdAt = new Date().toISOString();

  const rawSteps = Array.isArray(json.steps) ? (json.steps as RawStep[]) : [];

  const steps: HspStep[] = rawSteps.map((step, index) => ({
    id: step.id ?? `${planId}-step-${index + 1}`,
    title: step.title ?? `Step ${index + 1}`,
    prompt: step.prompt ?? "",
    check: step.check,
    hints: step.hints ?? [],
    tags: step.tags ?? [],
    dependencies: step.dependencies ?? [],
    taxonomy: sanitizeTaxonomy(step.taxonomy, step.tags),
  }));

  return {
    id: planId,
    problemId: input.problemId,
    sessionId: input.sessionId,
    goal: json.goal ?? input.goal ?? "",
    summary: json.summary,
    createdAt,
    steps,
    meta: {
      ...json.meta,
      canonicalText: input.canonicalText,
    },
  } satisfies HspPlan;
}

const buildPrompt = (input: GenerateHspInput) => `You are constructing a hidden solution plan for a Socratic tutor named Meno.

Canonical problem statement:
"""
${input.canonicalText}
"""

Generate a JSON plan with fields {id, goal, lessonTitle, summary, keywords[], relatedConcepts[], meta, steps[]}.
Each step should include: id, title, prompt (question to ask the learner), optional check expression (JavaScript or pseudocode), optional hints[], tags[], dependencies[], taxonomy.

The lessonTitle must be a concise, table-of-contents style name suitable for a mathematics curriculum (e.g., "Pythagorean Theorem – Diagonal Length"). Avoid literal phrases such as "Plain Text" or "Canonical Text".
Include keywords[] with succinct topic tags students might search for ("geometry", "square roots", etc.).
For each step, taxonomy must be one of ["definitional","analytical","proportional","spectral","evaluative"]. If a step blends multiple types, pick the dominant intent and include other signals in tags[].

Goal defaults to the learner's objective if not explicitly provided. Ensure the plan has 3-6 concise steps.`;

const extractJson = (payload: OpenAIResponse) => {
  const candidates = payload.output_text ?? payload.output?.flatMap((item) =>
    item.content?.map((entry) => entry.text ?? "") ?? [],
  ) ?? [];

  const raw = Array.isArray(candidates) ? candidates.join("\n") : String(candidates);
  const jsonText = findFirstJson(raw);

  if (!jsonText) {
    throw new Error("OpenAI response did not include JSON plan");
  }

  return JSON.parse(jsonText);
};

const findFirstJson = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
};

interface OpenAIResponse {
  output_text?: string[];
  output?: Array<{
    content?: Array<{ text?: string }>;
  }>;
}

interface RawStep {
  id?: string;
  title?: string;
  prompt?: string;
  check?: string;
  hints?: string[];
  tags?: string[];
  dependencies?: string[];
  taxonomy?: string;
}

const sanitizeTaxonomy = (taxonomy?: string, tags?: string[]): TaxonomyKey | undefined => {
  const lowered = taxonomy?.toLowerCase();
  if (isTaxonomyKey(lowered)) {
    return lowered;
  }

  if (Array.isArray(tags)) {
    for (const tag of tags) {
      const normalized = tag.toLowerCase();
      if (isTaxonomyKey(normalized)) {
        return normalized;
      }
    }
  }

  return undefined;
};

const TAXONOMY_KEYS: TaxonomyKey[] = [
  "definitional",
  "analytical",
  "proportional",
  "spectral",
  "evaluative",
];

const isTaxonomyKey = (value?: string): value is TaxonomyKey =>
  value ? (TAXONOMY_KEYS as string[]).includes(value) : false;

