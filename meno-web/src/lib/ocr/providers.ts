import { env } from "@/env";

export interface OcrExtraction {
    text: string;
    latex?: string;
    raw?: unknown;
}

const OPENAI_OCR_MODEL = "gpt-4.1-mini";

export async function extractMathFromImage(
    imageBase64: string,
    opts?: { prompt?: string },
): Promise<OcrExtraction> {
    if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required for OCR");
    }

    const prompt =
        opts?.prompt ??
        "Extract the canonical math text from this image. Return plain text and LaTeX if present.";

    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: OPENAI_OCR_MODEL,
            input: [
                {
                    role: "user",
                    content: [
                        { type: "input_text", text: prompt },
                        {
                            type: "input_image",
                            image_url: normalizeToDataUri(imageBase64),
                        },
                    ],
                },
            ],
            max_output_tokens: 1000,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI OCR failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
        output_text?: string[];
        output?: Array<{ content?: Array<{ text?: string }>; type?: string }>;
    };

    const outputText = data.output_text?.join("\n") ?? extractTextFromOutput(data.output);

    return {
        text: outputText.trim(),
        raw: data,
    };
}

const extractTextFromOutput = (
    output?: Array<{ content?: Array<{ text?: string }>; type?: string }>,
) => {
    if (!output) return "";
    const segments: string[] = [];
    for (const item of output) {
        if (!item?.content) continue;
        for (const content of item.content) {
            if (content?.text) {
                segments.push(content.text);
            }
        }
    }
    return segments.join("\n");
};

const normalizeToDataUri = (base64: string) =>
    base64.startsWith("data:image") ? base64 : `data:image/png;base64,${base64}`;

