import { NextResponse } from "next/server";

import { createInitialState, getDialogueState, upsertDialogueState } from "@/lib/dialogue/store";
import type { HeavyValidationRecord } from "@/lib/dialogue/types";
import { heavyResultToQuickCheck, runHeavyCheck } from "@/lib/validate/server";

interface ValidateRequestBody {
  sessionId?: string;
  planId?: string;
  referenceExpression?: string;
  studentExpression?: string;
  expectedUnits?: string[];
  variables?: string[];
}

export async function POST(request: Request): Promise<Response> {
  let payload: ValidateRequestBody;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Validate: invalid JSON", error);
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.sessionId || !payload.planId) {
    return NextResponse.json({ ok: false, error: "sessionId and planId are required" }, { status: 400 });
  }

  if (!payload.referenceExpression || !payload.studentExpression) {
    return NextResponse.json(
      { ok: false, error: "referenceExpression and studentExpression are required" },
      { status: 400 },
    );
  }

  try {
    const heavy = await runHeavyCheck({
      studentExpression: payload.studentExpression,
      referenceExpression: payload.referenceExpression,
      expectedUnits: payload.expectedUnits,
      variables: payload.variables,
    });

    const record: HeavyValidationRecord = {
      ...heavy,
      timestamp: new Date().toISOString(),
      referenceExpression: payload.referenceExpression,
      studentExpression: payload.studentExpression,
    };

    let state = await getDialogueState(payload.sessionId);
    if (!state || state.planId !== payload.planId) {
      state = createInitialState(payload.sessionId, payload.planId);
    }

    state.validations = [...state.validations, record].slice(-20);
    state.quickChecks = [...state.quickChecks, heavyResultToQuickCheck(heavy)].slice(-20);
    await upsertDialogueState(state);

    return NextResponse.json({ ok: true, data: record });
  } catch (error) {
    console.error("Validate: heavy check failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Validation failed" },
      { status: 500 },
    );
  }
}
