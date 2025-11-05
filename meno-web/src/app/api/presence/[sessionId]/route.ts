import { NextResponse } from "next/server";

import { listPresence } from "@/lib/presence/store";

interface Params {
  sessionId: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Params },
): Promise<Response> {
  const { sessionId } = params;

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
  }

  try {
    const presence = await listPresence(sessionId);
    return NextResponse.json({ ok: true, data: presence });
  } catch (error) {
    console.error("Presence list failed", error);
    const message = error instanceof Error ? error.message : "Unknown presence error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
