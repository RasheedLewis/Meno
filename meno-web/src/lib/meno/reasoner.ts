import { env } from "@/env";
import type { DialogueContextTurn, DialogueRecap, ErrorCategory } from "@/lib/dialogue/types";

const MODEL = "gpt-4.1-mini";

export const RECAP_SYSTEM_PROMPT = `You are Meno, a Socratic math tutor.
When provided with the hidden solution plan (HSP) goal and step details, produce a concise recap for students.
The recap must:
- Summarize the key reasoning in ≤3 sentences.
- Highlight what the learner accomplished.
- Suggest one next focus area or question.
- Maintain a confident, encouraging tone.`;

const PROMPT_SYSTEM_INSTRUCTIONS = `You are Meno, a Socratic math tutor guiding learners through mathematics.
Craft the next short question to ask the student. Requirements:
- At most 2 sentences.
- End with a focused question mark.
- Build on the student's latest response and the step prompt template.
- If a hint is provided, weave it naturally.
- Maintain an encouraging, curious tone.`;

export interface RecapContext {
  goal: string;
  summary?: string;
  steps: Array<{ title: string; prompt: string; hintLevel?: number }>;
  transcript?: DialogueContextTurn[];
  errorCategories?: ErrorCategory[];
}

export interface NextPromptContext {
  stepTitle: string;
  stepPrompt: string;
  taxonomy?: string;
  directive?: string | null;
  hint?: string | null;
  transcript: DialogueContextTurn[];
  goal: string;
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

  const errorCategories = Array.isArray(json.errorCategories)
    ? (json.errorCategories.filter((value: unknown): value is ErrorCategory =>
        value === "algebraic" || value === "arithmetic" || value === "units",
      ) as ErrorCategory[])
    : undefined;

  return {
    summary: json.summary ?? json.recаp ?? "Great work completing the plan!",
    highlights: Array.isArray(json.highlights) ? json.highlights : [],
    nextFocus: typeof json.nextFocus === "string" ? json.nextFocus : undefined,
    errorCategories,
  } satisfies DialogueRecap;
}

const buildRecapPrompt = (context: RecapContext) => `Hidden Solution Plan Recap Request
Goal: ${context.goal}
Plan Summary: ${context.summary ?? "(not provided)"}

Steps Completed:
${context.steps
  .map((step, index) => `Step ${index + 1}: ${step.title}\nPrompt: ${step.prompt}\nHints Used: ${step.hintLevel ?? 0}`)
  .join("\n\n")}

Dialogue Transcript:
${(context.transcript ?? [])
  .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
  .join("\n")}

Common Error Categories Observed: ${
  context.errorCategories?.length ? context.errorCategories.join(", ") : "none"
}

Return a JSON object with fields {summary: string, highlights: string[], nextFocus?: string, errorCategories?: string[]}. If errorCategories are provided, echo them back as a de-duplicated array using the labels "algebraic", "arithmetic", and "units" only.`;

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

export const generateNextPrompt = async (context: NextPromptContext): Promise<string> => {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to generate prompts");
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
          content: [{ type: "input_text", text: PROMPT_SYSTEM_INSTRUCTIONS }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPromptRequest(context),
            },
          ],
        },
      ],
      max_output_tokens: 300,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to generate prompt: ${response.status} ${message}`);
  }

  const payload = (await response.json()) as OpenAIResponse;
  const candidates = payload.output_text ?? payload.output?.flatMap((item) =>
    item.content?.map((entry) => entry.text ?? "") ?? [],
  ) ?? [];

  const text = Array.isArray(candidates) ? candidates.join(" ").trim() : String(candidates).trim();
  if (!text) {
    throw new Error("Prompt generation returned empty response");
  }
  return text;
};

const buildPromptRequest = (context: NextPromptContext) => `Goal: ${context.goal}
Current Step Title: ${context.stepTitle}
Step Prompt Template: ${context.stepPrompt}
Taxonomy: ${context.taxonomy ?? "(not provided)"}
Directive: ${context.directive ?? "(none)"}
Hint: ${context.hint ?? "(none)"}

Dialogue Transcript:
${context.transcript.map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`).join("\n")}

Return only the question text.`;

