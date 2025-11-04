"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import {
  useSessionStore,
  type Participant,
  type SessionDifficulty,
} from "@/lib/store/session";
import { useUiStore } from "@/lib/store/ui";

type Step = "welcome" | "identity" | "join" | "create" | "lobby";
type Mode = "join" | "create";

interface DemoSession {
  code: string;
  name: string;
  difficulty: SessionDifficulty;
  participants: Participant[];
}

const SESSION_CAPACITY = 4;
const INITIAL_SESSIONS: DemoSession[] = [
  {
    code: "4B6D",
    name: "Algebra Warmup",
    difficulty: "beginner",
    participants: [
      { id: "demo-1", name: "Theo", role: "student", presence: "online" },
      { id: "demo-2", name: "Mira", role: "student", presence: "online" },
    ],
  },
  {
    code: "EUCL",
    name: "Geometry Circle",
    difficulty: "intermediate",
    participants: [
      { id: "demo-3", name: "Ada", role: "student", presence: "online" },
    ],
  },
];

const codePattern = /^[A-Z0-9]{4,8}$/;
const namePattern = /^[A-Za-z]{1,20}$/;
const sessionNameMax = 40;

const digitsToSubscript: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

const toSubscript = (value: number) =>
  value
    .toString()
    .split("")
    .map((digit) => digitsToSubscript[digit] ?? digit)
    .join("");

const ensureUniqueName = (name: string, existing: string[]) => {
  if (!existing.includes(name)) return name;

  let suffix = 2;
  let candidate = `${name}${toSubscript(suffix)}`;
  while (existing.includes(candidate)) {
    suffix += 1;
    candidate = `${name}${toSubscript(suffix)}`;
  }
  return candidate;
};

const generateParticipantId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `participant-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
};

const generateSessionCode = (existingCodes: Set<string>) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 4 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
  } while (existingCodes.has(code));
  return code;
};

export function SessionJoinFlow({ className }: { className?: string }) {
  const router = useRouter();

  const participantName = useSessionStore((state) => state.participantName);
  const participantId = useSessionStore((state) => state.participantId);
  const role = useSessionStore((state) => state.role);
  const setParticipant = useSessionStore((state) => state.setParticipant);
  const setSessionId = useSessionStore((state) => state.setSessionId);
  const setSessionMeta = useSessionStore((state) => state.setSessionMeta);
  const setParticipants = useSessionStore((state) => state.setParticipants);
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
  const [joinAttempts, setJoinAttempts] = useState(0);

  const [sessionNameInput, setSessionNameInput] = useState("");
  const [sessionNameError, setSessionNameError] = useState<string | null>(null);
  const [difficultyInput, setDifficultyInput] = useState<SessionDifficulty>(
    difficulty ?? "beginner",
  );

  const [sessions, setSessions] = useState<Map<string, DemoSession>>(
    () =>
      new Map(INITIAL_SESSIONS.map((session) => [session.code, { ...session }])),
  );

  const isRateLimited = joinAttempts >= 3;

  const existingCodes = useMemo(() => new Set(sessions.keys()), [sessions]);

  useEffect(() => {
    if (step === "lobby") {
      showBanner();
    }
  }, [step, showBanner]);

  const validateName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError("Please enter your name.");
      return false;
    }
    if (!namePattern.test(trimmed)) {
      setNameError("Use 1–20 letters (A–Z).");
      return false;
    }
    setNameError(null);
    setNameInput(trimmed);
    return true;
  };

  const validateCode = () => {
    const trimmed = codeInput.trim().toUpperCase();
    if (!codePattern.test(trimmed)) {
      setCodeError("Please enter a valid code (A–Z, 0–9).");
      return null;
    }
    const session = sessions.get(trimmed);
    if (!session) {
      setCodeError("This session doesn’t exist.");
      return null;
    }
    if (session.participants.length >= SESSION_CAPACITY) {
      setCodeError("That session is full (4 students max).");
      return null;
    }
    setCodeError(null);
    return trimmed;
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
    if (!validateName()) {
      return;
    }
    if (mode === "join") {
      setStep("join");
    } else {
      setStep("create");
    }
  };

  const handleJoinSession = () => {
    if (isRateLimited) return;

    const validCode = validateCode();
    if (!validCode) {
      setJoinAttempts((count) => count + 1);
      return;
    }

    const session = sessions.get(validCode);
    if (!session) {
      setCodeError("This session doesn’t exist.");
      setJoinAttempts((count) => count + 1);
      return;
    }

    const trimmedName = nameInput.trim();
    const participantNames = session.participants.map((p) => p.name);
    const uniqueName = ensureUniqueName(trimmedName, participantNames);
    const id = participantId ?? generateParticipantId();

    const newParticipant: Participant = {
      id,
      name: uniqueName,
      role: "student",
      presence: "online",
    };

    const updatedSession: DemoSession = {
      ...session,
      participants: [...session.participants, newParticipant],
    };

    setSessions((prev) => {
      const clone = new Map(prev);
      clone.set(validCode, updatedSession);
      return clone;
    });

    setParticipant({ id, name: uniqueName });
    setSessionId(validCode);
    setSessionMeta({ sessionName: session.name, difficulty: session.difficulty });
    setParticipants(updatedSession.participants);
    setPhase("joining");
    setCodeInput(validCode);
    setJoinAttempts(0);
    setStep("lobby");
  };

  const handleCreateSession = () => {
    if (!validateName() || !validateSessionName()) {
      return;
    }

    const code = generateSessionCode(existingCodes);
    const trimmedName = nameInput.trim();
    const id = participantId ?? generateParticipantId();

    const newParticipant: Participant = {
      id,
      name: trimmedName,
      role,
      presence: "online",
    };

    const newSession: DemoSession = {
      code,
      name: sessionNameInput || "Untitled Session",
      difficulty: difficultyInput,
      participants: [newParticipant],
    };

    setSessions((prev) => {
      const clone = new Map(prev);
      clone.set(code, newSession);
      return clone;
    });

    setParticipant({ id, name: trimmedName });
    setSessionId(code);
    setSessionMeta({ sessionName: newSession.name, difficulty: difficultyInput });
    setParticipants(newSession.participants);
    setPhase("joining");
    setCodeInput(code);
    setStep("lobby");
  };

  const handleStartSession = () => {
    setPhase("active");
    router.push("/chat");
  };

  const lobbySessionInfo = useMemo(() => {
    if (!codeInput && mode === "join") return null;
    const targetCode = mode === "join" ? codeInput.trim().toUpperCase() : codeInput;
    return targetCode ? sessions.get(targetCode) ?? null : null;
  }, [codeInput, mode, sessions]);

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
          </label>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep("identity")}>Back</Button>
            <Button variant="primary" onClick={handleJoinSession} disabled={isRateLimited}>
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
            <Button variant="primary" onClick={handleCreateSession}>
              Generate Code
            </Button>
          </div>
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
                Session · {lobbySessionInfo?.name ?? "Socratic Circle"}
              </span>
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                {participants.length}/{SESSION_CAPACITY} joined
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

