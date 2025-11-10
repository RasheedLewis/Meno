import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/env";
import { getDocumentClient } from "@/lib/aws/dynamo";
import { randomId } from "@/lib/utils/random";

const client = getDocumentClient();

const tableName = env.SESSION_TABLE_NAME;

if (!tableName) {
  console.warn("SESSION_TABLE_NAME is not configured; session registry disabled");
}

export interface SessionParticipant {
  id: string;
  name: string;
  role: "student" | "teacher" | "observer";
  joinedAt: string;
}

export interface ActiveLineState {
  leaseId: string;
  stepIndex: number | null;
  leaseTo: string | null;
  leaseIssuedAt: string;
  leaseExpiresAt: number;
}

export interface SessionLineSubmitter {
  participantId?: string;
  name?: string;
  role?: "student" | "teacher" | "observer";
}

export interface SessionLineSolverOutcome {
  expression?: string | null;
  correctness?: "correct" | "incorrect" | "unknown";
  usefulness?: "useful" | "not_useful" | "unknown";
  confidence?: number | null;
  provider?: string | null;
  raw?: unknown;
  heavy?: unknown;
}

export interface SessionLineAttempt {
  attemptId: string;
  stepIndex: number;
  strokes: unknown;
  submitter?: SessionLineSubmitter;
  createdAt: string;
  snapshot?: string | null;
  solver?: SessionLineSolverOutcome | null;
}

export interface SessionRecord {
  sessionId: string;
  code: string;
  name?: string;
  difficulty?: string;
  creatorParticipantId: string;
  createdAt: string;
  expiresAt?: number;
  maxParticipants?: number;
  participants: Record<string, SessionParticipant>;
  activeLine?: ActiveLineState | null;
  attempts?: SessionLineAttempt[];
}

const TTL_SECONDS = 60 * 60 * 6; // 6 hours
const DEFAULT_LEASE_DURATION_MS = 30_000; // 30 seconds

export const DEFAULT_MAX_PARTICIPANTS = 4;

const computeExpiry = () => Math.floor(Date.now() / 1000) + TTL_SECONDS;

const normalizeParticipantsMap = (value: unknown): Record<string, SessionParticipant> => {
  if (!value) {
    return {};
  }

  if (Array.isArray(value)) {
    return value.reduce<Record<string, SessionParticipant>>((acc, item) => {
      if (item && typeof item === "object" && typeof item.id === "string") {
        acc[item.id] = {
          id: item.id,
          name: typeof item.name === "string" ? item.name : "",
          role: (item.role as SessionParticipant["role"]) ?? "student",
          joinedAt: typeof item.joinedAt === "string" ? item.joinedAt : new Date().toISOString(),
        };
      }
      return acc;
    }, {});
  }

  if (typeof value === "object") {
    const entries = value as Record<string, SessionParticipant>;
    return Object.entries(entries).reduce<Record<string, SessionParticipant>>((acc, [key, participant]) => {
      if (participant && typeof participant === "object") {
        const id = participant.id ?? key;
        if (typeof id === "string") {
          acc[id] = {
            id,
            name: participant.name ?? "",
            role: participant.role ?? "student",
            joinedAt: participant.joinedAt ?? new Date().toISOString(),
          };
        }
      }
      return acc;
    }, {});
  }

  return {};
};

export const participantsMapToList = (participants: Record<string, SessionParticipant> | undefined) =>
  Object.values(participants ?? {}).sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

const normalizeActiveLine = (value: unknown): ActiveLineState | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Partial<ActiveLineState>;
  const leaseExpiresAt = typeof source.leaseExpiresAt === "number" ? source.leaseExpiresAt : undefined;

  if (leaseExpiresAt && leaseExpiresAt < Date.now()) {
    return undefined;
  }

  return {
    leaseId: typeof source.leaseId === "string" && source.leaseId ? source.leaseId : randomId("lease"),
    stepIndex: typeof source.stepIndex === "number" ? source.stepIndex : null,
    leaseTo: typeof source.leaseTo === "string" ? source.leaseTo : null,
    leaseIssuedAt: typeof source.leaseIssuedAt === "string" ? source.leaseIssuedAt : new Date().toISOString(),
    leaseExpiresAt: leaseExpiresAt ?? Date.now() + DEFAULT_LEASE_DURATION_MS,
  };
};

const normalizeSessionRecord = (item: unknown): SessionRecord => {
  if (!item || typeof item !== "object") {
    throw new Error("Invalid session record");
  }

  const record = item as SessionRecord;
  const participants = normalizeParticipantsMap((record as unknown as { participants?: unknown }).participants);
  const activeLine = normalizeActiveLine((record as unknown as { activeLine?: unknown }).activeLine);
  const attempts =
    Array.isArray((record as unknown as { attempts?: unknown }).attempts) ?
      ((record as unknown as { attempts?: unknown }).attempts as SessionLineAttempt[]).map((attempt) => ({
        attemptId: attempt.attemptId,
        stepIndex: attempt.stepIndex,
        strokes: attempt.strokes,
        submitter: attempt.submitter,
        createdAt: attempt.createdAt,
        snapshot: attempt.snapshot ?? null,
        solver: attempt.solver
          ? {
              expression: attempt.solver.expression ?? null,
              correctness: attempt.solver.correctness ?? "unknown",
              usefulness: attempt.solver.usefulness ?? "unknown",
              confidence:
                typeof attempt.solver.confidence === "number"
                  ? attempt.solver.confidence
                  : null,
              provider: attempt.solver.provider,
              raw: attempt.solver.raw,
            }
          : null,
      })) :
      [];

  return {
    sessionId: record.sessionId,
    code: record.code,
    name: record.name,
    difficulty: record.difficulty,
    creatorParticipantId: record.creatorParticipantId,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    maxParticipants: record.maxParticipants,
    participants,
    activeLine: activeLine ?? null,
    attempts,
  };
};

export const createSession = async (record: SessionRecord): Promise<void> => {
  if (!tableName) return;

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        ...record,
        expiresAt: computeExpiry(),
        maxParticipants: record.maxParticipants ?? DEFAULT_MAX_PARTICIPANTS,
        participants: record.participants ?? {},
        ...(record.activeLine ? { activeLine: record.activeLine } : {}),
      },
      ConditionExpression: "attribute_not_exists(sessionId)",
    }),
  );
};

export const getSessionById = async (sessionId: string): Promise<SessionRecord | null> => {
  if (!tableName) return null;

  const response = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: { sessionId },
      ConsistentRead: true,
    }),
  );

  return response.Item ? normalizeSessionRecord(response.Item) : null;
};

export const getSessionByCode = async (code: string): Promise<SessionRecord | null> => {
  if (!tableName) return null;

  const response = await client.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "code-index",
      KeyConditionExpression: "code = :code",
      ExpressionAttributeValues: {
        ":code": code,
      },
      Limit: 1,
    }),
  );

  const item = response.Items?.[0];
  return item ? normalizeSessionRecord(item) : null;
};

export const addParticipantToSession = async (
  sessionId: string,
  participant: SessionParticipant,
): Promise<SessionRecord | null> => {
  if (!tableName) return null;

  const current = await getSessionById(sessionId);
  if (!current) {
    return null;
  }

  const participants = { ...current.participants };
  const existing = participants[participant.id];
  participants[participant.id] = {
    id: participant.id,
    name: participant.name,
    role: participant.role,
    joinedAt: existing?.joinedAt ?? participant.joinedAt,
  };

  const expiresAt = computeExpiry();

  const response = await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { sessionId },
      UpdateExpression: "SET participants = :participants, expiresAt = :expiresAt",
      ExpressionAttributeValues: {
        ":participants": participants,
        ":expiresAt": expiresAt,
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  if (response.Attributes) {
    return normalizeSessionRecord(response.Attributes);
  }

  return {
    ...current,
    participants,
    expiresAt,
  };
};

export interface ActiveLineLeasePayload {
  stepIndex: number | null;
  leaseTo: string | null;
  leaseDurationMs?: number;
}

export const setActiveLineLease = async (
  sessionId: string,
  payload: ActiveLineLeasePayload,
): Promise<SessionRecord | null> => {
  if (!tableName) return null;

  const leaseIssuedAt = new Date().toISOString();
  const leaseDuration = payload.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
  const leaseExpiresAt = Date.now() + leaseDuration;

  const activeLine: ActiveLineState = {
    leaseId: randomId("lease"),
    stepIndex: payload.stepIndex ?? null,
    leaseTo: payload.leaseTo ?? null,
    leaseIssuedAt,
    leaseExpiresAt,
  };

  const response = await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { sessionId },
      UpdateExpression: "SET activeLine = :activeLine, expiresAt = :expiresAt",
      ExpressionAttributeValues: {
        ":activeLine": activeLine,
        ":expiresAt": computeExpiry(),
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  return response.Attributes ? normalizeSessionRecord(response.Attributes) : null;
};

export const clearActiveLineLease = async (sessionId: string): Promise<SessionRecord | null> => {
  if (!tableName) return null;

  const response = await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { sessionId },
      UpdateExpression: "REMOVE activeLine SET expiresAt = :expiresAt",
      ExpressionAttributeValues: {
        ":expiresAt": computeExpiry(),
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  return response.Attributes ? normalizeSessionRecord(response.Attributes) : null;
};

interface AppendAttemptInput {
  stepIndex: number;
  strokes: unknown;
  submitter?: SessionLineSubmitter;
  snapshot?: string | null;
  solver?: SessionLineSolverOutcome | null;
}

export const appendSessionLineAttempt = async (
  sessionId: string,
  payload: AppendAttemptInput,
): Promise<SessionLineAttempt> => {
  if (!tableName) {
    throw new Error("SESSION_TABLE_NAME must be configured");
  }

  const createdAt = new Date().toISOString();
  const attempt: SessionLineAttempt = {
    attemptId: randomId("attempt"),
    stepIndex: payload.stepIndex,
    strokes: payload.strokes,
    submitter: payload.submitter,
    createdAt,
    snapshot: payload.snapshot ?? null,
    solver: payload.solver ?? null,
  };

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { sessionId },
      UpdateExpression:
        "SET attempts = list_append(if_not_exists(attempts, :emptyList), :attempt), expiresAt = :expiresAt",
      ExpressionAttributeValues: {
        ":attempt": [attempt],
        ":emptyList": [],
        ":expiresAt": computeExpiry(),
      },
    }),
  );

  return attempt;
};
