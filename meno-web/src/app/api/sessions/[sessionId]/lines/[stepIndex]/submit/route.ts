import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore nerdamer has no type definitions
import nerdamer from "nerdamer";
import "nerdamer/Solve";

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
import type { HeavyValidationRecord } from "@/lib/dialogue/types";

type ParticipantRole = "student" | "teacher" | "observer";

const isParticipantRole = (value: unknown): value is ParticipantRole =>
  value === "student" || value === "teacher" || value === "observer";

const extractEquation = (source?: string | null): string | null => {
  if (!source) return null;
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (line.includes("=") && !line.endsWith(":")) {
      const colonIndex = line.lastIndexOf(":");
      const equalsIndex = line.indexOf("=");
      const trimmedLine =
        colonIndex !== -1 && colonIndex < equalsIndex
          ? line.slice(colonIndex + 1)
          : line;
      return trimmedLine.trim();
    }
  }
  const inlineMatch = source.match(/[-+*/^()\s\dA-Za-z]+=[-+*/^()\s\dA-Za-z]+/);
  return inlineMatch ? inlineMatch[0].trim() : null;
};

const sanitizeEquation = (equation: string): string => {
  let sanitized = equation
    .replace(/\s+/g, "")
    .replace(/÷/g, "/")
    .replace(/×/g, "*")
    .replace(/−/g, "-")
    .replace(/—/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  sanitized = sanitized.replace(/([0-9])([a-zA-Z])/g, "$1*$2");
  sanitized = sanitized.replace(/([a-zA-Z])([0-9])/g, "$1*$2");
  sanitized = sanitized.replace(/\*\*/g, "^");
  return sanitized;
};

const detectVariable = (equation: string): string | null => {
  const matches = equation.match(/[a-zA-Z]/g);
  if (!matches) return null;
  const candidates = [...new Set(matches)].filter(
    (char) => char !== "e" && char !== "E",
  );
  return candidates.length > 0 ? candidates[0] : null;
};

const computeSolutionSet = (equation: string): string[] | null => {
  try {
    const normalized = sanitizeEquation(equation);
    const variable = detectVariable(normalized) ?? "x";
    const solveEquations = (nerdamer as { solveEquations?: (eq: string, variable: string) => unknown }).solveEquations;
    if (typeof solveEquations !== "function") {
      console.warn("nerdamer.solveEquations is not available");
      return null;
    }
    const solutions = solveEquations(normalized, variable);
    if (!Array.isArray(solutions)) {
      return null;
    }
    return solutions.map((solution) => {
      try {
        return nerdamer(solution).text();
      } catch {
        return String(solution);
      }
    });
  } catch (error) {
    console.warn("Failed to compute solution set", equation, error);
    return null;
  }
};

const compareEquationSolutions = (
  canonicalEquation: string,
  studentEquation: string,
): boolean => {
  const canonicalSolutions = computeSolutionSet(canonicalEquation);
  const studentSolutions = computeSolutionSet(studentEquation);
  if (!canonicalSolutions || !studentSolutions) {
    return false;
  }
  if (canonicalSolutions.length !== studentSolutions.length) {
    return false;
  }
  const canonicalSet = new Set(
    canonicalSolutions.map((solution) => solution.trim()),
  );
  for (const solution of studentSolutions) {
    const trimmed = solution.trim();
    if (!canonicalSet.has(trimmed)) {
      return false;
    }
  }
  return true;
};

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
    let heavyRecord: HeavyValidationRecord | undefined;

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
            usefulness = heavy.equivalent ? "useful" : "not_useful";
            shouldAdvance = heavy.equivalent;
            heavyRecord = {
              equivalent: heavy.equivalent,
              unitsMatch: heavy.unitsMatch,
              equivalenceDetail: heavy.equivalenceDetail,
              unitsDetail: heavy.unitsDetail,
              timestamp: new Date().toISOString(),
              referenceExpression,
              studentExpression: expression,
            };
          } catch (error) {
            solverError =
              error instanceof Error ? error.message : "Solver comparison failed";
            correctness = "unknown";
            usefulness = "unknown";
            shouldAdvance = false;
          }
        } else if (expression) {
          correctness = "unknown";
          usefulness = "unknown";
          shouldAdvance = false;
        } else {
          correctness = "incorrect";
          usefulness = "not_useful";
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
          heavy: heavyRecord,
        };
      } else {
        solverError = solverResult.error;
        solverOutcome = {
          expression: null,
          correctness: "incorrect",
          usefulness: "not_useful",
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

    if (!shouldAdvance && solverOutcome?.correctness === "unknown" && solverOutcome.expression && canonicalQuestion) {
      const canonicalEquation = extractEquation(canonicalQuestion);
      const studentEquation = extractEquation(solverOutcome.expression);
      if (canonicalEquation && studentEquation) {
        const equivalent = compareEquationSolutions(canonicalEquation, studentEquation);
        solverOutcome = {
          ...solverOutcome,
          correctness: equivalent ? "correct" : "incorrect",
          usefulness: equivalent ? "useful" : "not_useful",
          heavy: {
            equivalent,
            unitsMatch: true,
            equivalenceDetail: equivalent
              ? "Matches original equation solution set."
              : "Solution set differs from original equation.",
            unitsDetail: undefined,
            timestamp: new Date().toISOString(),
            referenceExpression: canonicalEquation,
            studentExpression: studentEquation,
          },
        };
        shouldAdvance = equivalent;
        if (!equivalent && !solverError) {
          solverError = "This line does not preserve the original equation.";
        }
      }
    }

    const submitter =
      body.submitter && typeof body.submitter === "object"
        ? {
            participantId: body.submitter.participantId,
            name: body.submitter.name,
            role: isParticipantRole(body.submitter.role)
              ? body.submitter.role
              : undefined,
          }
        : undefined;

    const attempt = await appendSessionLineAttempt(sessionId, {
      stepIndex: parsedStepIndex,
      strokes: body.strokes,
      submitter,
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

