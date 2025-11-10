import type {
  ActiveLineLease,
  SessionLineAttempt,
  SessionLineSubmitter,
} from "@/lib/store/session";

export interface LeaseStateResponse {
  ok: true;
  data: ActiveLineLease | null;
}

export interface LeaseErrorResponse {
  ok: false;
  error: string;
}

const jsonHeaders = {
  "Content-Type": "application/json",
};

export async function fetchLease(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}/lease`, {
    method: "GET",
    cache: "no-store",
  });
  return (await response.json()) as LeaseStateResponse | LeaseErrorResponse;
}

export async function takeLease(sessionId: string, body: { stepIndex: number; leaseTo?: string | null; leaseDurationMs?: number; }) {
  const response = await fetch(`/api/sessions/${sessionId}/lease/take`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  return (await response.json()) as LeaseStateResponse | LeaseErrorResponse;
}

export async function releaseLease(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}/lease/release`, {
    method: "POST",
    headers: jsonHeaders,
  });
  return (await response.json()) as LeaseStateResponse | LeaseErrorResponse;
}

export interface SubmitLineBody {
  strokes: unknown;
  leaseTo?: string | null;
  submitter?: SessionLineSubmitter;
  snapshot?: string | null;
  planId?: string | null;
}

export interface SubmitLineResponse {
  ok: true;
  data: {
    attempt: SessionLineAttempt;
    nextActiveLine: ActiveLineLease | null;
    advanced: boolean;
    solverError: string | null;
  };
}

export type SubmitLineError = LeaseErrorResponse;

export async function submitLine(
  sessionId: string,
  stepIndex: number,
  body: SubmitLineBody,
) {
  const response = await fetch(`/api/sessions/${sessionId}/lines/${stepIndex}/submit`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  return (await response.json()) as SubmitLineResponse | SubmitLineError;
}

