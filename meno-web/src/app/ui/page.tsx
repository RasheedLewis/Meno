"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Sheet } from "@/components/ui/Sheet";

export default function UiShowcasePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="w-fit font-sans text-sm uppercase tracking-[0.3em] text-accent/70 hover:text-accent"
        >
          ← Back to overview
        </Link>
        <h1 className="text-4xl font-semibold text-[var(--ink)]">
          UI Primitives Showcase
        </h1>
        <p className="max-w-2xl font-sans text-base text-[var(--muted)]">
          Preview the foundational components that shape Meno’s Socratic interface. Buttons,
          inputs, cards, and overlays inherit the parchment & slate theme and are ready for
          feature integrations.
        </p>
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

