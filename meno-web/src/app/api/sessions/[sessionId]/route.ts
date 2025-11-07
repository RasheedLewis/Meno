import { NextResponse } from "next/server";

import { getSessionById, participantsMapToList } from "@/lib/session/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  try {
    const params = await context.params;
    const { sessionId } = params;

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Session id is required" }, { status: 400 });
    }

    const session = await getSessionById(sessionId);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    }

    const participants = participantsMapToList(session.participants);

    return NextResponse.json({
      ok: true,
      data: {
        sessionId: session.sessionId,
        code: session.code,
        name: session.name ?? null,
        difficulty: session.difficulty ?? null,
        participants,
        maxParticipants: session.maxParticipants ?? null,
      },
    });
  } catch (error) {
    console.error("Session fetch failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

