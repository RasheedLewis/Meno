"use client";

import Link from "next/link";
import { useState } from "react";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Sheet } from "@/components/ui/Sheet";
import { useSessionStore } from "@/lib/store/session";
import { randomId } from "@/lib/utils/random";

export default function UiShowcasePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const sessionId = useSessionStore((state) => state.sessionId);
  const setSessionId = useSessionStore((state) => state.setSessionId);
  const participantId = useSessionStore((state) => state.participantId);
  const participantName = useSessionStore((state) => state.participantName);
  const setParticipant = useSessionStore((state) => state.setParticipant);
  const phase = useSessionStore((state) => state.phase);
  const setPhase = useSessionStore((state) => state.setPhase);
  const upsertParticipant = useSessionStore((state) => state.upsertParticipant);
  const participants = useSessionStore((state) => state.participants);
  const resetSession = useSessionStore((state) => state.resetSession);
  const storeSnapshot = JSON.stringify(
    {
      sessionId: sessionId ?? "—",
      phase,
      participants: participants.length,
    },
    null,
    2,
  );

  const handleSessionIdChange = (value: string) => {
    const trimmed = value.trim();
    setSessionId(trimmed.length === 0 ? null : trimmed);
  };

  const handleParticipantNameChange = (value: string) => {
    const id = participantId ?? "local-client";
    setParticipant({ id, name: value });
    upsertParticipant({
      id,
      name: value || "Anonymous",
      role: "student",
      presence: "online",
    });
  };

  const handleJoinSession = () => {
    const name = participantName || "Anonymous";
    const id = participantId ?? randomId("participant");
    const effectiveSession = sessionId ?? `session-${id.slice(0, 5)}`;
    setSessionId(effectiveSession);
    setParticipant({ id, name });
    upsertParticipant({ id, name, role: "student", presence: "online" });
    setPhase("active");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="w-fit font-sans text-sm uppercase tracking-[0.3em] text-accent/70 hover:text-accent"
        >
          ← Back to overview
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-[var(--ink)]">UI Primitives Showcase</h1>
            <p className="mt-2 max-w-2xl font-sans text-base text-[var(--muted)]">
              Preview the foundational components that shape Meno’s Socratic interface. Buttons, inputs, cards, and overlays inherit the parchment & slate theme and are ready for feature integrations.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>Buttons</CardHeader>
          <CardBody className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
          </CardBody>
          <CardFooter>
            <span className="font-sans text-sm text-[var(--muted)]">
              Rounded forms and accent ring reinforce theme consistency.
            </span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>Inputs</CardHeader>
          <CardBody className="flex flex-col gap-4">
            <Input placeholder="Student name" />
            <Input placeholder="Session code" />
          </CardBody>
          <CardFooter>
            <span className="font-sans text-sm text-[var(--muted)]">
              Subtle borders and focus rings keep focus on the dialogue.
            </span>
          </CardFooter>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>Modal</CardHeader>
          <CardBody className="flex flex-col gap-4">
            <p className="font-sans text-[var(--muted)]">
              Use modals for pivotal confirmations, session summaries, or teacher overrides.
            </p>
            <Button variant="primary" onClick={() => setIsModalOpen(true)}>
              Open Modal
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Sheet</CardHeader>
          <CardBody className="flex flex-col gap-4">
            <p className="font-sans text-[var(--muted)]">
              Sheets slide in for secondary flows like roster management or settings.
            </p>
            <Button onClick={() => setIsSheetOpen(true)}>Open Sheet</Button>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>Session Store</CardHeader>
          <CardBody className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 font-sans text-sm text-[var(--muted)]">
                Session ID
                <Input
                  value={sessionId ?? ""}
                  placeholder="e.g. algebra-101"
                  onChange={(event) => handleSessionIdChange(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 font-sans text-sm text-[var(--muted)]">
                Your name
                <Input
                  value={participantName}
                  placeholder="Add a display name"
                  onChange={(event) => handleParticipantNameChange(event.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={handleJoinSession}>
                Join / Resume Session
              </Button>
              <Button variant="ghost" onClick={resetSession}>
                Reset
              </Button>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)]/70 p-4 font-mono text-xs leading-relaxed text-[var(--muted)]">
              <p className="mb-2 font-sans text-sm font-medium uppercase tracking-wider text-[var(--ink)]">
                Store Snapshot
              </p>
              <pre className="whitespace-pre-wrap">{storeSnapshot}</pre>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Phase Controls</CardHeader>
          <CardBody className="flex flex-col gap-3">
            <p className="font-sans text-sm text-[var(--muted)]">
              Future flows will transition phases automatically. For now, toggle states to
              validate orchestration logic.
            </p>
            <div className="flex flex-wrap gap-2">
              {(["idle", "joining", "active", "completed"] as const).map((state) => (
                <Button
                  key={state}
                  size="sm"
                  variant={phase === state ? "primary" : "secondary"}
                  onClick={() => setPhase(state)}
                >
                  {state}
                </Button>
              ))}
            </div>
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--paper)]/60 p-4 font-sans text-sm text-[var(--muted)]">
              Active participants: {participants.map((p) => p.name || "Anonymous").join(", ") || "—"}
            </div>
          </CardBody>
          <CardFooter>
            <span className="font-sans text-sm text-[var(--muted)]">
              Zustand persistence keeps session context across refreshes.
            </span>
          </CardFooter>
        </Card>
      </section>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Session Recap"
        description="Modal surfaces important checkpoints in the student journey."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
            <Button variant="primary" onClick={() => setIsModalOpen(false)}>
              Save Transcript
            </Button>
          </>
        }
      >
        <p className="font-sans text-[var(--ink)]">
          Summarize key steps, highlight aporia moments, and capture follow-up notes before
          moving to the next problem.
        </p>
      </Modal>

      <Sheet open={isSheetOpen} onClose={() => setIsSheetOpen(false)}>
        <div className="flex h-full flex-col gap-6 p-6">
          <header className="flex items-center justify-between">
            <h2 className="font-serif text-2xl text-[var(--ink)]">Session Settings</h2>
            <Button variant="ghost" onClick={() => setIsSheetOpen(false)}>
              Close
            </Button>
          </header>
          <div className="flex flex-col gap-4 font-sans text-sm text-[var(--muted)]">
            <div>
              <p className="font-medium text-[var(--ink)]">Collaboration Mode</p>
              <p>Enable companion tablet, whiteboard sync, and student presence.</p>
            </div>
            <div>
              <p className="font-medium text-[var(--ink)]">Voice & Captions</p>
              <p>Configure Whisper STT, TTS cadence, and caption sizing.</p>
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

