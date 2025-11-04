import { NextResponse } from "next/server";

import { fetchHspPlan } from "@/lib/hsp/store";
import type { HspStep } from "@/lib/hsp/schema";
import {
  createInitialState,
  getDialogueState,
  upsertDialogueState,
} from "@/lib/dialogue/store";
import { classifyStepTaxonomy } from "@/lib/meno/taxonomy";
import type { StudentTurnFeedback } from "@/lib/dialogue/types";

type Success = {
  ok: true;
  data: {
    step: HspStep | null;
    promptTemplate: string | null;
    stepIndex: number;
    totalSteps: number;
    completedStepIds: string[];
    done: boolean;
    goal: string;
    summary?: string;
    taxonomy: ReturnType<typeof classifyStepTaxonomy>;
    hintLevel: number;
    hint: string | null;
    attemptCount: number;
    instructions: string;
  };
};

type Failure = { ok: false; error: string };

export async function POST(request: Request): Promise<Response> {
  let payload: {
    sessionId?: string;
    planId?: string;
    advance?: boolean;
    studentTurn?: StudentTurnFeedback;
  };

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Dialogue: invalid JSON", error);
    return NextResponse.json<Failure>({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.sessionId || !payload.planId) {
    return NextResponse.json<Failure>(
      { ok: false, error: "sessionId and planId are required" },
      { status: 400 },
    );
  }

  const plan = await fetchHspPlan(payload.planId);

  if (!plan) {
    return NextResponse.json<Failure>(
      { ok: false, error: "Hidden solution plan not found" },
      { status: 404 },
    );
  }

  const steps = plan.steps ?? [];
  let state = await getDialogueState(payload.sessionId);

  if (!state || state.planId !== plan.id) {
    state = createInitialState(payload.sessionId, plan.id);
  }

  if (payload.advance && state.currentStepIndex < steps.length) {
    const completedStep = steps[state.currentStepIndex];
    if (completedStep) {
      const completedSet = new Set([...state.completedStepIds, completedStep.id]);
      state.completedStepIds = Array.from(completedSet);
    }
    state.currentStepIndex = Math.min(state.currentStepIndex + 1, steps.length);
    state.hintLevel = 0;
    state.attemptCount = 0;
    state.lastPromptAt = new Date().toISOString();
  }

  const done = state.currentStepIndex >= steps.length;
  const currentStep = done ? null : steps[state.currentStepIndex];
  const hints = currentStep?.hints ?? [];

  if (payload.studentTurn && !done) {
    const now = new Date().toISOString();
    state.lastStudentTurnAt = now;

    switch (payload.studentTurn.outcome) {
      case "productive":
        state.attemptCount = 0;
        break;
      case "inconclusive":
      case "unproductive":
        state.attemptCount += 1;
        if (hints.length > 0 && state.attemptCount >= 2 && state.hintLevel < hints.length) {
          state.hintLevel += 1;
          state.attemptCount = 0;
        }
        break;
      default:
        break;
    }
  }

  state.updatedAt = new Date().toISOString();

  await upsertDialogueState(state);

  const activeHint = !done && state.hintLevel > 0 && hints[state.hintLevel - 1] ? hints[state.hintLevel - 1] : null;
  const brevityInstruction = done
    ? "Provide a concise recap in ≤3 sentences and invite reflection."
    : state.hintLevel > 0
    ? "Offer the next hint concisely (≤2 sentences) and end with a focused question."
    : "Respond in no more than 2 sentences and finish with a focused question.";

  const response: Success = {
    ok: true,
    data: {
      step: currentStep,
      promptTemplate: currentStep?.prompt ?? null,
      stepIndex: state.currentStepIndex,
      totalSteps: steps.length,
      completedStepIds: state.completedStepIds,
      done,
      goal: plan.goal,
      summary: plan.summary,
      taxonomy: classifyStepTaxonomy(currentStep),
      hintLevel: state.hintLevel,
      hint: activeHint,
      instructions: brevityInstruction,
      attemptCount: state.attemptCount,
    },
  };

  return NextResponse.json(response);
}

