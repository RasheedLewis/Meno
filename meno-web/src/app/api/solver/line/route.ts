import { NextResponse } from "next/server";

import {
  recognizeHandwriting,
  mathpixEnabled,
  type MathpixResult,
} from "@/lib/solver/mathpix";

interface SolverRequestBody {
  sessionId: string;
  stepIndex: number;
  snapshot: string;
  strokes?: unknown;
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
    const ocrResult: MathpixResult = await recognizeHandwriting(payload.snapshot);

    if (!ocrResult.ok) {
      console.error("Mathpix OCR error", ocrResult.error);
      return NextResponse.json(
        {
          ok: false,
          error: ocrResult.error,
          data: {
            expression: null,
            raw: ocrResult.raw ?? null,
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
        expression: ocrResult.expression,
        confidence: ocrResult.confidence,
        provider: ocrResult.provider,
        raw: ocrResult.raw,
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

