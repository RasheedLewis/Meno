import { NextResponse } from "next/server";

import { generateHiddenSolutionPlan } from "@/lib/hsp/generate";
import { fetchHspPlan, persistHspPlan } from "@/lib/hsp/store";
import type { GenerateHspInput, OcrUploadRecord } from "@/lib/hsp/schema";
import { normalizeId } from "@/lib/utils/id";

type Success = { ok: true; data: Awaited<ReturnType<typeof generateHiddenSolutionPlan>> };
type Failure = { ok: false; error: string };

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("id");

  if (!planId) {
    return NextResponse.json<Failure>(
      { ok: false, error: "Query parameter 'id' is required" },
      { status: 400 },
    );
  }

  try {
    const plan = await fetchHspPlan(planId);
    if (!plan) {
      return NextResponse.json<Failure>(
        { ok: false, error: "Plan not found" },
        { status: 404 },
      );
    }
    return NextResponse.json<Success>({ ok: true, data: plan });
  } catch (error) {
    console.error("HSP: fetch failed", error);
    return NextResponse.json<Failure>(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch plan" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  let payload: Partial<GenerateHspInput> & {
    upload?: Partial<OcrUploadRecord>;
  };

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

    if (payload.upload) {
      const uploads = Array.isArray(plan.meta?.uploads)
        ? [...plan.meta!.uploads]
        : [];
      const record: OcrUploadRecord = {
        id: payload.upload.id ?? `${normalizeId(plan.id)}-${Date.now()}`,
        fileName: payload.upload.fileName ?? "Upload",
        canonicalText:
          payload.upload.canonicalText ?? plan.meta?.canonicalText ?? payload.canonicalText ?? "",
        plainText: payload.upload.plainText ?? payload.upload.canonicalText ?? "",
        latex: payload.upload.latex,
        imageBase64: payload.upload.imageBase64,
        uploadedAt: payload.upload.uploadedAt ?? new Date().toISOString(),
      };
      plan.meta = {
        ...(plan.meta ?? {}),
        canonicalText: plan.meta?.canonicalText ?? payload.canonicalText,
        uploads: [record, ...uploads],
      };
    }

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

