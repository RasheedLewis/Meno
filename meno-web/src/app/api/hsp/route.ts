import { NextResponse } from "next/server";

import { generateHiddenSolutionPlan } from "@/lib/hsp/generate";
import { persistHspPlan } from "@/lib/hsp/store";
import type { GenerateHspInput } from "@/lib/hsp/schema";

type Success = { ok: true; data: Awaited<ReturnType<typeof generateHiddenSolutionPlan>> };
type Failure = { ok: false; error: string };

export async function POST(request: Request): Promise<Response> {
  let payload: Partial<GenerateHspInput>;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("HSP: invalid JSON", error);
    return NextResponse.json<Failure>({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload?.sessionId || !payload.problemId || !payload.canonicalText) {
    return NextResponse.json<Failure>(
      { ok: false, error: "sessionId, problemId, and canonicalText are required" },
      { status: 400 },
    );
  }

  try {
    const plan = await generateHiddenSolutionPlan({
      canonicalText: payload.canonicalText,
      goal: payload.goal,
      problemId: payload.problemId,
      sessionId: payload.sessionId,
    });

    await persistHspPlan(plan);

    return NextResponse.json<Success>({ ok: true, data: plan });
  } catch (error) {
    console.error("HSP: generation failed", error);

    if (isResourceNotFound(error)) {
      return NextResponse.json<Failure>(
        {
          ok: false,
          error: `Hidden solution plan table not found. Please create '${process.env.HSP_TABLE_NAME}' in DynamoDB with partition key 'planId'.`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json<Failure>(
      { ok: false, error: error instanceof Error ? error.message : "Failed to generate plan" },
      { status: 500 },
    );
  }
}

const isResourceNotFound = (error: unknown): boolean =>
  Boolean(error && typeof error === "object" && (error as { name?: string }).name === "ResourceNotFoundException");

