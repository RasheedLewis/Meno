import { env } from "@/env";
import type { DialogueRecap } from "@/lib/dialogue/types";

const MODEL = "gpt-4.1-mini";

export const RECAP_SYSTEM_PROMPT = `You are Meno, a Socratic math tutor.
When provided with the hidden solution plan (HSP) goal and step details, produce a concise recap for students.
The recap must:
- Summarize the key reasoning in ≤3 sentences.
- Highlight what the learner accomplished.
- Suggest one next focus area or question.
- Maintain a confident, encouraging tone.`;

export interface RecapContext {
  goal: string;
  summary?: string;
  steps: Array<{ title: string; prompt: string; hintLevel?: number }>;
}

export async function generateRecap(context: RecapContext): Promise<DialogueRecap> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to generate recaps");
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
          role: "system",
          content: [{ type: "input_text", text: RECAP_SYSTEM_PROMPT }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildRecapPrompt(context),
            },
          ],
        },
      ],
      max_output_tokens: 800,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to generate recap: ${response.status} ${message}`);
  }

  const payload = (await response.json()) as OpenAIResponse;
  const json = extractJson(payload);

  return {
    summary: json.summary ?? json.recаp ?? "Great work completing the plan!",
    highlights: Array.isArray(json.highlights) ? json.highlights : [],
    nextFocus: typeof json.nextFocus === "string" ? json.nextFocus : undefined,
  } satisfies DialogueRecap;
}

const buildRecapPrompt = (context: RecapContext) => `Hidden Solution Plan Recap Request
Goal: ${context.goal}
Plan Summary: ${context.summary ?? "(not provided)"}

Steps Completed:
${context.steps
  .map((step, index) => `Step ${index + 1}: ${step.title}\nPrompt: ${step.prompt}\nHints Used: ${step.hintLevel ?? 0}`)
  .join("\n\n")}

Return a JSON object with fields {summary: string, highlights: string[], nextFocus?: string}.`;

const extractJson = (payload: OpenAIResponse) => {
  const candidates = payload.output_text ?? payload.output?.flatMap((item) =>
    item.content?.map((entry) => entry.text ?? "") ?? [],
  ) ?? [];

  const raw = Array.isArray(candidates) ? candidates.join("\n") : String(candidates);
  const jsonText = raw.match(/\{[\s\S]*\}/)?.[0];

  if (!jsonText) {
    throw new Error("OpenAI recap response did not include JSON");
  }

  return JSON.parse(jsonText);
};

interface OpenAIResponse {
  output_text?: string[];
  output?: Array<{
    content?: Array<{ text?: string }>;
  }>;
}

