import { API_BASE_URL } from '@/constants/config';
import type { ActiveLineLease } from '@/hooks/use-chat-control';

interface LeaseResponseOk {
  ok: true;
  data: ActiveLineLease | null;
}

interface LeaseResponseErr {
  ok: false;
  error: string;
}

export interface SessionLineSubmitter {
  participantId?: string | null;
  name?: string | null;
  role?: string | null;
}

export interface SessionLineSolverOutcome {
  expression?: string | null;
  correctness?: 'correct' | 'incorrect' | 'unknown';
  usefulness?: 'useful' | 'not_useful' | 'unknown';
  confidence?: number | null;
  provider?: string | null;
  raw?: unknown;
  heavy?: unknown;
}

export interface SessionLineAttempt {
  attemptId: string;
  stepIndex: number;
  strokes: unknown;
  submitter?: SessionLineSubmitter | null;
  createdAt: string;
  snapshot?: string | null;
  solver?: SessionLineSolverOutcome | null;
}

interface SubmitLineResponseOk {
  ok: true;
  data: {
    attempt: SessionLineAttempt;
    nextActiveLine: ActiveLineLease | null;
    advanced: boolean;
    solverError: string | null;
  };
}

type SubmitLineResponseErr = LeaseResponseErr;

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export async function fetchLease(sessionId: string) {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/lease`, {
    method: 'GET',
    headers: jsonHeaders,
    cache: 'no-store',
  });
  return (await response.json()) as LeaseResponseOk | LeaseResponseErr;
}

export async function takeLease(
  sessionId: string,
  body: { stepIndex: number; leaseTo: string; leaseDurationMs?: number },
) {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/lease/take`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  return (await response.json()) as LeaseResponseOk | LeaseResponseErr;
}

export async function releaseLease(sessionId: string) {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/lease/release`, {
    method: 'POST',
    headers: jsonHeaders,
  });
  return (await response.json()) as LeaseResponseOk | LeaseResponseErr;
}

export interface SubmitLineBody {
  strokes: unknown;
  leaseTo?: string | null;
  submitter?: SessionLineSubmitter;
  snapshot?: string | null;
  planId?: string | null;
}

export async function submitLine(sessionId: string, stepIndex: number, body: SubmitLineBody) {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/lines/${stepIndex}/submit`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  return (await response.json()) as SubmitLineResponseOk | SubmitLineResponseErr;
}

