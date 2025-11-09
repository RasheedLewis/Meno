import { NextResponse } from "next/server";

import { env } from "@/env";

interface SolverRequestBody {
  sessionId: string;
  stepIndex: number;
  snapshot: string;
  strokes?: unknown;
}

interface MathpixRequestBody {
  src: string;
  formats: string[];
  data_options?: {
    include_asciimath?: boolean;
    include_latex?: boolean;
    include_mathml?: boolean;
  };
}

interface MathpixResponse {
  latex_styled?: string;
  latex_normal?: string;
  text?: string;
  error?: string;
  data?: {
    confidence?: number;
  };
}

const MATHPIX_APP_ID = process.env.MATHPIX_APP_ID ?? env.MATHPIX_APP_ID;
const MATHPIX_APP_KEY = process.env.MATHPIX_APP_KEY ?? env.MATHPIX_APP_KEY;

const mathpixEnabled = Boolean(MATHPIX_APP_ID && MATHPIX_APP_KEY);

async function callMathpix(snapshot: string): Promise<MathpixResponse> {
  if (!mathpixEnabled) {
    return {
      latex_normal: "",
      text: "",
      error: "Mathpix credentials not configured",
    };
  }

  const body: MathpixRequestBody = {
    src: snapshot,
    formats: ["latex_styled", "latex_normal", "asciimath"],
    data_options: {
      include_asciimath: true,
      include_latex: true,
      include_mathml: false,
    },
  };

  const response = await fetch("https://api.mathpix.com/v3/text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      app_id: MATHPIX_APP_ID!,
      app_key: MATHPIX_APP_KEY!,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    return {
      latex_normal: "",
      text: "",
      error: `Mathpix error: ${response.status} ${message}`,
    };
  }

  return (await response.json()) as MathpixResponse;
}

export async function POST(request: Request): Promise<Response> {
  let payload: SolverRequestBody | null = null;
  try {
    payload = (await request.json()) as SolverRequestBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  if (
    !payload ||
    !payload.sessionId ||
    typeof payload.stepIndex !== "number" ||
    !payload.snapshot
  ) {
    return NextResponse.json(
      { ok: false, error: "sessionId, stepIndex, and snapshot are required" },
      { status: 400 },
    );
  }

  try {
    const ocrResult = await callMathpix(payload.snapshot);

    if (ocrResult.error) {
      console.error("Mathpix OCR error", ocrResult.error);
      return NextResponse.json(
        {
          ok: false,
          error: ocrResult.error,
          data: {
            expression: ocrResult.latex_normal ?? null,
            raw: ocrResult,
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        sessionId: payload.sessionId,
        stepIndex: payload.stepIndex,
        expression: ocrResult.latex_normal ?? ocrResult.latex_styled ?? null,
        text: ocrResult.text ?? null,
        confidence: ocrResult.data?.confidence ?? null,
        raw: ocrResult,
      },
    });
  } catch (error) {
    console.error("Solver OCR failed", error);
    const message =
      error instanceof Error ? error.message : "Unknown solver error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

