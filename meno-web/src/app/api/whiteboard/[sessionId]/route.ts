import { NextResponse } from "next/server";

import { getWhiteboardSnapshot, putWhiteboardSnapshot } from "@/lib/whiteboard/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  try {
    const { sessionId } = await context.params;
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
    }

    const record = await getWhiteboardSnapshot(sessionId);
    if (!record) {
      return NextResponse.json({ ok: true, data: null });
    }

    return NextResponse.json({
      ok: true,
      data: {
        snapshot: record.snapshot,
        updatedAt: record.updatedAt,
      },
    });
  } catch (error) {
    console.error("Whiteboard snapshot fetch failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  try {
    const { sessionId } = await context.params;
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
    }

    const payload = (await request.json()) as { snapshot?: string; updatedAt?: string };
    if (!payload?.snapshot || typeof payload.snapshot !== "string") {
      return NextResponse.json({ ok: false, error: "snapshot is required" }, { status: 400 });
    }

    const updatedAt =
      typeof payload.updatedAt === "string" && payload.updatedAt.length > 0
        ? payload.updatedAt
        : new Date().toISOString();

    await putWhiteboardSnapshot(sessionId, payload.snapshot, updatedAt);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Whiteboard snapshot persist failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

