import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import {
  appendSessionLineAttempt,
  getSessionById,
  setActiveLineLease,
  type SessionLineSolverOutcome,
} from "@/lib/session/store";
import {
  mathpixEnabled,
  recognizeHandwriting,
} from "@/lib/solver/mathpix";
import { fetchHspPlan } from "@/lib/hsp/store";
import { extractQuickCheckConfig } from "@/lib/validate/client";
import { runHeavyCheck } from "@/lib/validate/server";

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
  planId?: string | null;
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
    const shouldAttemptOcr = snapshotProvided && mathpixEnabled;

    let solverError: string | null = null;
    let shouldAdvance = !snapshotProvided || !mathpixEnabled;
    let solverOutcome: SessionLineSolverOutcome | null = null;

    let referenceExpression: string | undefined;
    let expectedUnits: string[] | undefined;
    let canonicalQuestion: string | undefined;

    if (body.planId) {
      try {
        const plan = await fetchHspPlan(body.planId);
        const step = plan?.steps?.[parsedStepIndex] ?? null;
        canonicalQuestion = plan?.meta?.canonicalText ?? plan?.goal;
        if (step) {
          const config = extractQuickCheckConfig(step);
          referenceExpression = config?.referenceExpression;
          expectedUnits = config?.expectedUnits;
        }
      } catch (error) {
        console.warn("Solver: failed to fetch HSP plan", error);
      }
    }

    if (shouldAttemptOcr) {
      const solverResult = await recognizeHandwriting(body.snapshot!);
      if (solverResult.ok) {
        const expression = solverResult.expression;
        let correctness: SessionLineSolverOutcome["correctness"] = "unknown";
        let usefulness: SessionLineSolverOutcome["usefulness"] = "unknown";

        if (expression && referenceExpression) {
          try {
            const heavy = await runHeavyCheck({
              studentExpression: expression,
              referenceExpression,
              expectedUnits,
            });
            correctness = heavy.equivalent ? "correct" : "incorrect";
            usefulness = heavy.equivalent ? "useful" : "neutral";
            shouldAdvance = heavy.equivalent;
          } catch (error) {
            solverError =
              error instanceof Error ? error.message : "Solver comparison failed";
            correctness = "unknown";
            usefulness = "neutral";
            shouldAdvance = false;
          }
        } else if (expression) {
          correctness = "unknown";
          usefulness = "neutral";
          shouldAdvance = false;
        } else {
          correctness = "incorrect";
          usefulness = "neutral";
          shouldAdvance = false;
        }

        solverOutcome = {
          expression,
          correctness,
          usefulness,
          confidence: solverResult.confidence,
          provider: solverResult.provider,
          raw: {
            ...solverResult.raw,
            referenceExpression,
            canonicalQuestion,
          },
        };
      } else {
        solverError = solverResult.error;
        solverOutcome = {
          expression: null,
          correctness: "incorrect",
          usefulness: "neutral",
          confidence: null,
          provider: solverResult.provider,
          raw: {
            ...(solverResult.raw ?? {}),
            canonicalQuestion,
          },
        };
        shouldAdvance = false;
      }
    } else if (snapshotProvided && !mathpixEnabled) {
      solverError = "Mathpix credentials not configured";
      shouldAdvance = false;
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
    } else {
      const updated = await setActiveLineLease(sessionId, {
        stepIndex: parsedStepIndex,
        leaseTo: body.leaseTo ?? null,
      });
      nextActiveLine =
        updated?.activeLine ??
        nextActiveLine ?? {
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

