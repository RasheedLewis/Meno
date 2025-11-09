import { NextResponse } from "next/server";

import {
  getSessionById,
  setActiveLineLease,
} from "@/lib/session/store";

interface Params {
  sessionId: string;
}

interface TakeLeaseBody {
  stepIndex: number;
  leaseTo?: string | null;
  leaseDurationMs?: number;
}

export async function POST(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  const { sessionId } = await context.params;

  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "sessionId is required" },
      { status: 400 },
    );
  }

  let body: TakeLeaseBody | null = null;
  try {
    body = (await request.json()) as TakeLeaseBody;
  } catch {
    // no-op, handled below
  }

  if (!body || typeof body.stepIndex !== "number" || body.stepIndex < 0) {
    return NextResponse.json(
      { ok: false, error: "stepIndex must be a non-negative number" },
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

    const updated = await setActiveLineLease(sessionId, {
      stepIndex: body.stepIndex,
      leaseTo: body.leaseTo ?? null,
      leaseDurationMs:
        typeof body.leaseDurationMs === "number"
          ? body.leaseDurationMs
          : undefined,
    });

    return NextResponse.json({
      ok: true,
      data: updated?.activeLine ?? session.activeLine ?? null,
    });
  } catch (error) {
    console.error("Lease take failed", error);
    const message =
      error instanceof Error ? error.message : "Unknown lease take error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

