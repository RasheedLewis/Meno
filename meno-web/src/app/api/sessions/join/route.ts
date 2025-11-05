import { NextResponse } from "next/server";

import {
  addParticipantToSession,
  DEFAULT_MAX_PARTICIPANTS,
  getSessionByCode,
  getSessionById,
  type SessionRecord,
} from "@/lib/session/store";
import { normalizeSessionCode } from "@/lib/session/code";

interface JoinSessionRequest {
  code?: string;
  sessionId?: string;
  participant: {
    id: string;
    name: string;
    role?: "student" | "teacher" | "observer";
  };
}

const isExpired = (session: SessionRecord) => session.expiresAt !== undefined && session.expiresAt < Math.floor(Date.now() / 1000);

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as JoinSessionRequest;

    if (!payload?.participant?.id || !payload.participant.name) {
      return NextResponse.json({ ok: false, error: "Participant id and name are required" }, { status: 400 });
    }

    let session: SessionRecord | null = null;

    if (payload.sessionId) {
      session = await getSessionById(payload.sessionId);
    } else if (payload.code) {
      session = await getSessionByCode(normalizeSessionCode(payload.code));
    } else {
      return NextResponse.json({ ok: false, error: "Provide sessionId or code" }, { status: 400 });
    }

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    }

    if (isExpired(session)) {
      return NextResponse.json({ ok: false, error: "Session expired" }, { status: 410 });
    }

    const maxParticipants = session.maxParticipants ?? DEFAULT_MAX_PARTICIPANTS;
    const participants = session.participants ?? [];
    const alreadyMember = participants.some((participant) => participant.id === payload.participant.id);

    if (!alreadyMember && participants.length >= maxParticipants) {
      return NextResponse.json({ ok: false, error: "Session is full" }, { status: 409 });
    }

    const updated = await addParticipantToSession(session.sessionId, {
      id: payload.participant.id,
      name: payload.participant.name,
      role: payload.participant.role ?? "student",
      joinedAt: new Date().toISOString(),
    });

    const finalSession = updated ?? session;

    return NextResponse.json({
      ok: true,
      data: {
        sessionId: finalSession.sessionId,
        code: finalSession.code,
        name: finalSession.name ?? null,
        difficulty: finalSession.difficulty ?? null,
        participants: finalSession.participants,
        maxParticipants,
      },
    });
  } catch (error) {
    console.error("Session join failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
