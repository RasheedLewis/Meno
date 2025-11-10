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

