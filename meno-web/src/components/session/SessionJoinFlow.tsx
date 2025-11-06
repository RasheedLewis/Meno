"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { useSessionStore, type Participant, type SessionDifficulty, type ParticipantRole } from "@/lib/store/session";
import { normalizeSessionCode } from "@/lib/session/code";
import { useUiStore } from "@/lib/store/ui";

type Step = "welcome" | "identity" | "join" | "create" | "lobby";
type Mode = "join" | "create";

const codePattern = /^[A-Z0-9]{4,8}$/;
const namePattern = /^[A-Za-z]{1,20}$/;
const sessionNameMax = 40;

interface JoinErrors {
  name: string | null;
  code: string | null;
  general: string | null;
}

const INITIAL_ERRORS: JoinErrors = {
  name: null,
  code: null,
  general: null,
};

interface SessionJoinFlowProps {
  className?: string;
}

const participantIdKey = "meno-participant-id";

const ensureParticipantId = () => {
  if (typeof window === "undefined") return `participant-${Math.random().toString(36).slice(2, 10)}`;
  const existing = localStorage.getItem(participantIdKey);
  if (existing) return existing;
  const id = globalThis.crypto?.randomUUID?.() ?? `participant-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(participantIdKey, id);
  return id;
};

export function SessionJoinFlow({ className }: SessionJoinFlowProps) {
  const router = useRouter();

  const participantName = useSessionStore((state) => state.participantName);
  const participantId = useMemo(() => ensureParticipantId(), []);
  const role = useSessionStore((state) => state.role);
  const setParticipant = useSessionStore((state) => state.setParticipant);
  const setSessionId = useSessionStore((state) => state.setSessionId);
  const setSessionCode = useSessionStore((state) => state.setSessionCode);
  const setSessionMeta = useSessionStore((state) => state.setSessionMeta);
  const setPhase = useSessionStore((state) => state.setPhase);
  const participants = useSessionStore((state) => state.participants);
  const difficulty = useSessionStore((state) => state.difficulty);
  const bannerDismissed = useUiStore((state) => state.bannerDismissed);
  const showBanner = useUiStore((state) => state.showBanner);

  const [step, setStep] = useState<Step>("welcome");
  const [mode, setMode] = useState<Mode>("join");
  const [nameInput, setNameInput] = useState(participantName);
  const [nameError, setNameError] = useState<string | null>(null);

  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const [sessionNameInput, setSessionNameInput] = useState("");
  const [sessionNameError, setSessionNameError] = useState<string | null>(null);
  const [difficultyInput, setDifficultyInput] = useState<SessionDifficulty>(
    difficulty ?? "beginner",
  );

  const [errors, setErrors] = useState<JoinErrors>(INITIAL_ERRORS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<{
    code: string;
    name: string | null;
    difficulty: SessionDifficulty | null;
    maxParticipants: number;
  } | null>(null);

  const isRateLimited = false; // Removed demo session rate limiting

  useEffect(() => {
    if (step === "lobby") {
      showBanner();
    }
  }, [step, showBanner]);

  const validateNameInput = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError("Please enter your name.");
      return { ok: false as const };
    }
    if (!namePattern.test(trimmed)) {
      setNameError("Use 1–20 letters (A–Z).");
      return { ok: false as const };
    }
    setNameError(null);
    return { ok: true as const, value: trimmed };
  };

  const validateCodeInput = () => {
    const trimmed = codeInput.trim().toUpperCase();
    if (!trimmed) {
      setCodeError("Enter your session code.");
      return { ok: false as const };
    }
    if (!codePattern.test(trimmed)) {
      setCodeError("Please enter a valid code (A–Z, 0–9).");
      return { ok: false as const };
    }
    setCodeError(null);
    return { ok: true as const, value: trimmed };
  };

  const validateSessionName = () => {
    if (!sessionNameInput) {
      setSessionNameError(null);
      return true;
    }
    if (sessionNameInput.length > sessionNameMax) {
      setSessionNameError(`Keep the session name under ${sessionNameMax} characters.`);
      return false;
    }
    setSessionNameError(null);
    return true;
  };

  const handleProceedIdentity = (selectedMode: Mode) => {
    setMode(selectedMode);
    setStep("identity");
  };

  const handleIdentitySubmit = () => {
    if (!validateNameInput().ok) {
      return;
    }
    if (mode === "join") {
      setStep("join");
    } else {
      setStep("create");
    }
  };

  const setGlobalLoading = useSessionStore((state) => state.setLoading);
  const setGlobalError = useSessionStore((state) => state.setError);
  const hydrateSession = useSessionStore((state) => state.hydrateFromServer);

  const handleCreate = async () => {
    const nameResult = validateNameInput();
    const sessionNameValid = validateSessionName();
    if (!nameResult.ok || !sessionNameValid) {
      return;
    }

    setErrors(INITIAL_ERRORS);
    setIsSubmitting(true);
    setGlobalLoading(true);
    setGlobalError(null);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sessionNameInput,
          difficulty: difficultyInput,
          participant: {
            id: participantId,
            name: nameResult.value,
            role: role,
          },
        }),
      });

      const payload = (await response.json()) as
        | {
            ok: true;
            data: {
              sessionId: string;
              code: string;
              name: string | null;
              difficulty: string | null;
              participant: { id: string; name: string; role: ParticipantRole };
              maxParticipants: number;
            };
          }
        | { ok: false; error: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "Failed to create session" : payload.error);
      }

      const sessionId = payload.data.sessionId;
      setSessionId(sessionId);
      setSessionCode(payload.data.code);
      setParticipant({ id: participantId, name: payload.data.participant.name, role: payload.data.participant.role });
      setNameInput(payload.data.participant.name);
      hydrateSession({
        sessionId,
        code: payload.data.code,
        sessionName: payload.data.name,
        difficulty: (payload.data.difficulty as SessionDifficulty | null) ?? null,
        participants: [
          {
            id: payload.data.participant.id,
            name: payload.data.participant.name,
            role: payload.data.participant.role,
            presence: "online",
          } satisfies Participant,
        ],
      });
      setSessionMeta({ sessionName: payload.data.name, difficulty: (payload.data.difficulty as SessionDifficulty | null) ?? undefined });
      setSessionSummary({
        code: payload.data.code,
        name: payload.data.name,
        difficulty: (payload.data.difficulty as SessionDifficulty | null) ?? null,
        maxParticipants: payload.data.maxParticipants,
      });
      setCodeInput(payload.data.code);
      setStep("lobby");
      setPhase("joining");
      showToast({
        variant: "success",
        title: "Session ready",
        description: `Share code ${payload.data.code} with up to ${payload.data.maxParticipants} learners guided by Meno.`,
      });
    } catch (error) {
      console.error("Session create failed", error);
      const message = error instanceof Error ? error.message : "Unable to create session";
      setErrors((prev) => ({ ...prev, general: message }));
      setGlobalError(message);
    } finally {
      setIsSubmitting(false);
      setGlobalLoading(false);
    }
  };

  const handleJoin = async () => {
    const nameResult = validateNameInput();
    const codeResult = validateCodeInput();
    if (!nameResult.ok || !codeResult.ok) {
      return;
    }

    const normalized = normalizeSessionCode(codeResult.value);
    setErrors(INITIAL_ERRORS);
    setIsSubmitting(true);
    setGlobalLoading(true);
    setGlobalError(null);

    try {
      const response = await fetch("/api/sessions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: normalized,
          participant: {
            id: participantId,
            name: nameResult.value,
            role: role,
          },
        }),
      });

      const payload = (await response.json()) as
        | {
            ok: true;
            data: {
              sessionId: string;
              code: string;
              name: string | null;
              difficulty: string | null;
              participants: Array<{ id: string; name: string; role: ParticipantRole }>;
              maxParticipants: number;
            };
          }
        | { ok: false; error: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "Failed to join session" : payload.error);
      }

      const sessionId = payload.data.sessionId;
      setSessionId(sessionId);
      setSessionCode(payload.data.code ?? null);
      setParticipant({ id: participantId, name: nameResult.value, role });
      setNameInput(nameResult.value);
      hydrateSession({
        sessionId,
        code: payload.data.code,
        sessionName: payload.data.name,
        difficulty: (payload.data.difficulty as SessionDifficulty | null) ?? null,
        participants: payload.data.participants.map((participant) => ({
          id: participant.id,
          name: participant.name,
          role: participant.role,
          presence: "online",
        })),
      });
      setSessionMeta({ sessionName: payload.data.name, difficulty: (payload.data.difficulty as SessionDifficulty | null) ?? undefined });
      setSessionSummary({
        code: payload.data.code,
        name: payload.data.name,
        difficulty: (payload.data.difficulty as SessionDifficulty | null) ?? null,
        maxParticipants: payload.data.maxParticipants,
      });
      setStep("lobby");
      setPhase("joining");
      showToast({
        variant: "success",
        title: "Joined session",
        description: "Let’s see what everyone is thinking.",
      });
    } catch (error) {
      console.error("Session join failed", error);
      const message = error instanceof Error ? error.message : "Unable to join session";
      setErrors((prev) => ({ ...prev, general: message }));
      setGlobalError(message);
    } finally {
      setIsSubmitting(false);
      setGlobalLoading(false);
    }
  };

  const handleStartSession = () => {
    setPhase("active");
    router.push("/chat");
  };

  const nameHint = "Used to show who’s speaking and drawing.";
  const codeHint = "Ask your teacher or teammate for their code.";

  return (
    <Card className={cn("space-y-6", className)}>
      {step === "welcome" && (
        <div className="space-y-6 text-center">
          <div>
            <h2 className="font-serif text-3xl text-[var(--ink)]">Welcome to Meno</h2>
            <p className="mt-2 font-sans text-sm text-[var(--muted)]">
              Join your study circle or begin a new one.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="primary" onClick={() => handleProceedIdentity("join")}>Join Session</Button>
            <Button variant="ghost" onClick={() => handleProceedIdentity("create")}>
              Start a New Session
            </Button>
          </div>
          <p className="font-sans text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            You can join up to 3 others guided by Meno.
          </p>
        </div>
      )}

      {step === "identity" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-serif text-2xl text-[var(--ink)]">Your Seat</h2>
            <p className="mt-2 font-sans text-sm text-[var(--muted)]">Introduce yourself to the group.</p>
          </div>
          <label className="flex flex-col gap-2 font-sans text-sm text-[var(--muted)]">
            Your Name
            <Input
              value={nameInput}
              placeholder="e.g. Sophia"
              onChange={(event) => setNameInput(event.target.value)}
              aria-describedby="name-hint"
              aria-invalid={Boolean(nameError)}
            />
            <span id="name-hint" className="text-xs text-[var(--muted)]">
              {nameHint}
            </span>
            {nameError ? <span className="text-xs text-[#b94a44]">{nameError}</span> : null}
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep("welcome")}>Back</Button>
            <Button variant="primary" onClick={handleIdentitySubmit}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "join" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-serif text-2xl text-[var(--ink)]">Join a Session</h2>
            <p className="mt-2 font-sans text-sm text-[var(--muted)]">
              Enter the code shared by your teacher or teammate.
            </p>
          </div>
          {errors.general ? (
            <div className="rounded-xl border border-[#b94a44] bg-[#b94a44]/10 px-3 py-2 text-sm font-sans text-[#b94a44]">
              {errors.general}
            </div>
          ) : null}
          <label className="flex flex-col gap-2 font-sans text-sm text-[var(--muted)]">
            Session Code
            <Input
              value={codeInput}
              placeholder="e.g. 4B6D"
              onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
              aria-describedby="code-hint"
              aria-invalid={Boolean(codeError)}
              maxLength={8}
            />
            <span id="code-hint" className="text-xs text-[var(--muted)]">
              {codeHint}
            </span>
            {codeError ? <span className="text-xs text-[#b94a44]">{codeError}</span> : null}
            {isRateLimited ? (
              <span className="text-xs text-[#b94a44]">
                Too many attempts. Please wait a moment before trying again.
              </span>
            ) : null}
            {errors.general ? <span className="text-xs text-[#b94a44]">{errors.general}</span> : null}
          </label>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep("identity")}>Back</Button>
            <Button variant="primary" onClick={handleJoin} disabled={isSubmitting}>
              Join Session
            </Button>
          </div>
        </div>
      )}

      {step === "create" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-serif text-2xl text-[var(--ink)]">Create a New Session</h2>
            <p className="mt-2 font-sans text-sm text-[var(--muted)]">
              Share the generated code with others to join your group.
            </p>
          </div>
          {errors.general ? (
            <div className="rounded-xl border border-[#b94a44] bg-[#b94a44]/10 px-3 py-2 text-sm font-sans text-[#b94a44]">
              {errors.general}
            </div>
          ) : null}
          <label className="flex flex-col gap-2 font-sans text-sm text-[var(--muted)]">
            Session Name <span className="text-xs text-[var(--muted)]">Optional</span>
            <Input
              value={sessionNameInput}
              placeholder="e.g. Pythagorean Proof"
              onChange={(event) => setSessionNameInput(event.target.value)}
              maxLength={sessionNameMax}
              aria-invalid={Boolean(sessionNameError)}
            />
            {sessionNameError ? <span className="text-xs text-[#b94a44]">{sessionNameError}</span> : null}
          </label>
          <fieldset className="space-y-3 font-sans text-sm text-[var(--muted)]">
            <legend className="font-medium text-[var(--ink)]">Difficulty</legend>
            <div className="flex flex-wrap gap-2">
              {["beginner", "intermediate", "advanced"].map((level) => (
                <label
                  key={level}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-2",
                    difficultyInput === level
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--ink)]"
                      : "border-[var(--border)] bg-[var(--paper)]/80",
                  )}
                >
                  <input
                    type="radio"
                    name="difficulty"
                    value={level}
                    checked={difficultyInput === level}
                    onChange={() => setDifficultyInput(level as SessionDifficulty)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="capitalize">{level}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep("identity")}>Back</Button>
            <Button variant="primary" onClick={handleCreate} disabled={isSubmitting}>
              Generate Code
            </Button>
          </div>
          {errors.general ? <span className="text-xs text-[#b94a44]">{errors.general}</span> : null}
        </div>
      )}

      {step === "lobby" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-serif text-2xl text-[var(--ink)]">Lobby</h2>
            <p className="mt-2 font-sans text-sm text-[var(--muted)]">
              When everyone is ready, acknowledge Meno’s approach and begin.
            </p>
          </div>
          {mode === "create" ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)]/80 px-4 py-3 text-sm font-sans text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">Share this code:</span>{" "}
              <span className="ml-2 font-mono text-base tracking-widest text-[var(--ink)]">
                {codeInput || "--"}
              </span>
            </div>
          ) : null}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)]/70 px-4 py-4 font-sans text-sm text-[var(--muted)]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--ink)]">
                Session · {sessionSummary?.name ?? "Socratic Circle"}
              </span>
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                {participants.length}/{sessionSummary?.maxParticipants ?? 0} joined
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {participants.map((participant) => (
                <li
                  key={participant.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--paper)] px-3 py-2"
                >
                  <span className="font-medium text-[var(--ink)]">{participant.name}</span>
                  <span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                    {participant.role === "teacher" ? "Facilitator" : "Learner"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2 text-center">
            <Button
              variant="primary"
              onClick={handleStartSession}
              disabled={!bannerDismissed}
            >
              Start Session
            </Button>
            {!bannerDismissed ? (
              <span className="text-xs font-sans text-[var(--muted)]">
                Review Meno’s approach above to continue.
              </span>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}

