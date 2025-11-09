import { env } from "@/env";

const MATHPIX_APP_ID = process.env.MATHPIX_APP_ID ?? env.MATHPIX_APP_ID;
const MATHPIX_APP_KEY = process.env.MATHPIX_APP_KEY ?? env.MATHPIX_APP_KEY;

export interface MathpixSuccess {
  ok: true;
  expression: string | null;
  confidence: number | null;
  raw: MathpixResponse;
  provider: "mathpix";
}

export interface MathpixFailure {
  ok: false;
  error: string;
  raw?: MathpixResponse | null;
  provider: "mathpix";
}

export type MathpixResult = MathpixSuccess | MathpixFailure;

export interface MathpixResponse {
  latex_styled?: string;
  latex_normal?: string;
  text?: string;
  error?: string;
  data?: {
    confidence?: number;
  };
}

const isConfigured = Boolean(MATHPIX_APP_ID && MATHPIX_APP_KEY);

export const mathpixEnabled = isConfigured;

export async function recognizeHandwriting(snapshot: string): Promise<MathpixResult> {
  if (!mathpixEnabled) {
    return {
      ok: false,
      error: "Mathpix credentials not configured",
      provider: "mathpix",
    };
  }

  try {
    const response = await fetch("https://api.mathpix.com/v3/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        app_id: MATHPIX_APP_ID!,
        app_key: MATHPIX_APP_KEY!,
      },
      body: JSON.stringify({
        src: snapshot,
        formats: ["latex_normal", "latex_styled"],
        data_options: {
          include_asciimath: true,
          include_latex: true,
        },
      }),
    });

    const payload = (await response.json()) as MathpixResponse;

    if (!response.ok || payload.error) {
      const message = payload.error ?? `Mathpix error (${response.status})`;
      return {
        ok: false,
        error: message,
        raw: payload,
        provider: "mathpix",
      };
    }

    return {
      ok: true,
      expression: payload.latex_normal ?? payload.latex_styled ?? null,
      confidence: payload.data?.confidence ?? null,
      raw: payload,
      provider: "mathpix",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown mathpix error";
    return {
      ok: false,
      error: message,
      provider: "mathpix",
    };
  }
}

