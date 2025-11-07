import { NextResponse } from "next/server";

import { createSession, DEFAULT_MAX_PARTICIPANTS, getSessionByCode, type SessionParticipant } from "@/lib/session/store";
import { generateSessionCode } from "@/lib/session/code";

interface CreateSessionRequest {
  name?: string;
  difficulty?: string;
  participant: {
    id: string;
    name: string;
    role?: "student" | "teacher" | "observer";
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as CreateSessionRequest;

    if (!payload?.participant?.id || !payload.participant.name) {
      return NextResponse.json({ ok: false, error: "Participant id and name are required" }, { status: 400 });
    }

    const sessionId = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}`;

    let code = generateSessionCode(4);
    let attempts = 0;
    while (attempts < 10) {
      const existing = await getSessionByCode(code);
      if (!existing) {
        break;
      }
      code = generateSessionCode(4 + Math.floor(attempts / 3));
      attempts += 1;
    }

    if (attempts >= 10) {
      return NextResponse.json({ ok: false, error: "Unable to generate session code" }, { status: 500 });
    }

    const now = new Date().toISOString();

    const participant: SessionParticipant = {
      id: payload.participant.id,
      name: payload.participant.name,
      role: payload.participant.role ?? "student",
      joinedAt: now,
    };

    await createSession({
      sessionId,
      code,
      name: payload.name,
      difficulty: payload.difficulty,
      creatorParticipantId: payload.participant.id,
      createdAt: now,
      maxParticipants: DEFAULT_MAX_PARTICIPANTS,
      participants: {
        [participant.id]: participant,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        sessionId,
        code,
        name: payload.name ?? null,
        difficulty: payload.difficulty ?? null,
        participant: {
          id: payload.participant.id,
          name: payload.participant.name,
          role: payload.participant.role ?? "student",
        },
        maxParticipants: DEFAULT_MAX_PARTICIPANTS,
      },
    });
  } catch (error) {
    console.error("Session create failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
