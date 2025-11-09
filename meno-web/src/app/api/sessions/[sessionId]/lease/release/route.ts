import { NextResponse } from "next/server";

import {
  clearActiveLineLease,
  getSessionById,
} from "@/lib/session/store";

interface Params {
  sessionId: string;
}

export async function POST(
  _request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  const { sessionId } = await context.params;

  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "sessionId is required" },
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

    const updated = await clearActiveLineLease(sessionId);

    return NextResponse.json({
      ok: true,
      data: updated?.activeLine ?? null,
    });
  } catch (error) {
    console.error("Lease release failed", error);
    const message =
      error instanceof Error ? error.message : "Unknown lease release error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

