import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import {
  appendSessionLineAttempt,
  getSessionById,
  setActiveLineLease,
} from "@/lib/session/store";
import {
  mathpixEnabled,
  recognizeHandwriting,
} from "@/lib/solver/mathpix";

interface Params {
  sessionId: string;
  stepIndex: string;
}

interface SubmitBody {
  strokes: unknown;
  leaseTo?: string | null;
  submitter?: {
    participantId?: string;
    name?: string;
    role?: string;
  };
  snapshot?: string | null;
}

export async function POST(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  const { sessionId, stepIndex } = await context.params;

  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "sessionId is required" },
      { status: 400 },
    );
  }

  const parsedStepIndex = Number(stepIndex);
  if (!Number.isFinite(parsedStepIndex) || parsedStepIndex < 0) {
    return NextResponse.json(
      { ok: false, error: "stepIndex must be a non-negative number" },
      { status: 400 },
    );
  }

  let body: SubmitBody | null = null;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    // handled below
  }

  if (!body || body.strokes === undefined || body.strokes === null) {
    return NextResponse.json(
      { ok: false, error: "strokes payload is required" },
      { status: 400 },
    );
  }

  try {
    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Session not found" },
        { status: 404 },
      );
    }

    const snapshotProvided =
      typeof body.snapshot === "string" && body.snapshot.length > 0;
    const shouldAttemptSolver = snapshotProvided && mathpixEnabled;

    let solverError: string | null = null;
    let shouldAdvance = !snapshotProvided || !mathpixEnabled;
    let solverOutcome = null;

    if (shouldAttemptSolver) {
      const solverResult = await recognizeHandwriting(body.snapshot!);
      if (solverResult.ok) {
        shouldAdvance = true;
        solverOutcome = {
          expression: solverResult.expression,
          correctness: "correct" as const,
          usefulness: "useful" as const,
          confidence: solverResult.confidence,
          provider: solverResult.provider,
          raw: solverResult.raw,
        };
      } else {
        shouldAdvance = false;
        solverError = solverResult.error;
        solverOutcome = {
          expression: null,
          correctness: "incorrect" as const,
          usefulness: "neutral" as const,
          confidence: null,
          provider: solverResult.provider,
          raw: solverResult.raw ?? null,
        };
      }
    } else if (snapshotProvided && !mathpixEnabled) {
      solverError = "Mathpix credentials not configured";
    }

    const attempt = await appendSessionLineAttempt(sessionId, {
      stepIndex: parsedStepIndex,
      strokes: body.strokes,
      submitter: body.submitter,
      snapshot: typeof body.snapshot === "string" ? body.snapshot : null,
      solver: solverOutcome,
    });

    let nextActiveLine = session.activeLine ?? null;

    if (shouldAdvance) {
      const updated = await setActiveLineLease(sessionId, {
        stepIndex: parsedStepIndex + 1,
        leaseTo: body.leaseTo ?? null,
      });
      nextActiveLine =
        updated?.activeLine ??
        nextActiveLine ?? {
          leaseId: randomUUID(),
          stepIndex: parsedStepIndex + 1,
          leaseTo: body.leaseTo ?? null,
          leaseIssuedAt: new Date().toISOString(),
          leaseExpiresAt: Date.now() + 30_000,
        };
    } else if (!nextActiveLine) {
      nextActiveLine = {
        leaseId: randomUUID(),
        stepIndex: parsedStepIndex,
        leaseTo: body.leaseTo ?? null,
        leaseIssuedAt: new Date().toISOString(),
        leaseExpiresAt: Date.now() + 30_000,
      };
    }

    return NextResponse.json({
      ok: true,
      data: {
        attempt,
        nextActiveLine,
        advanced: shouldAdvance,
        solverError,
      },
    });
  } catch (error) {
    console.error("Line submit failed", error);
    const message =
      error instanceof Error ? error.message : "Unknown line submit error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

