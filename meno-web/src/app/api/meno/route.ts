import { NextResponse } from "next/server";

import { fetchHspPlan } from "@/lib/hsp/store";
import type { HspStep } from "@/lib/hsp/schema";
import {
  createInitialState,
  getDialogueState,
  upsertDialogueState,
} from "@/lib/dialogue/store";

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
  };
};

type Failure = { ok: false; error: string };

export async function POST(request: Request): Promise<Response> {
  let payload: {
    sessionId?: string;
    planId?: string;
    advance?: boolean;
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
  }

  const done = state.currentStepIndex >= steps.length;
  const currentStep = done ? null : steps[state.currentStepIndex];

  state.updatedAt = new Date().toISOString();

  await upsertDialogueState(state);

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
    },
  };

  return NextResponse.json(response);
}

