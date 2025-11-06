import Link from "next/link";

import { SessionJoinFlow } from "@/components/session/SessionJoinFlow";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium uppercase tracking-[0.3em] text-accent/80">
            Guided by Questions
          </span>
          <h1 className="text-4xl font-semibold leading-tight text-ink">Meno</h1>
          <p className="font-sans text-lg text-muted">
            The classical Socratic tutor for mathematics.
          </p>
        </div>
        <div className="flex items-start gap-4">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-paper/80 px-4 py-2 font-sans text-sm text-accent transition hover:bg-paper"
          >
            Launch Session
            <span aria-hidden>→</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-col gap-12">
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold leading-tight text-ink">
            Guided by questions, powered by dialogue.
          </h2>
          <p className="max-w-2xl font-sans text-lg leading-relaxed text-muted">
            Meno helps students unpack mathematics through Socratic conversation, collaborative whiteboarding, and a hidden solution plan that keeps every prompt purposeful.
          </p>
          <div className="flex flex-wrap gap-4 font-sans text-sm uppercase tracking-[0.3em] text-accent/80">
            <span>Dialogue First</span>
            <span>Voice + Captions</span>
            <span>Shared Canvas</span>
            <span>Hidden Solution Plan</span>
          </div>
          <div className="flex flex-wrap gap-6">
            <Link
              href="/ui"
              className="inline-flex items-center gap-2 font-sans text-sm text-accent underline-offset-4 transition hover:underline"
            >
              Preview the UI primitives
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 font-sans text-sm text-accent underline-offset-4 transition hover:underline"
            >
              Explore the session prototype
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        <SessionJoinFlow />

        <section className="grid gap-6 md:grid-cols-2">
          <article className="rounded-xl border border-[var(--border)] bg-paper/90 p-6 shadow-sm backdrop-blur">
            <h3 className="text-2xl font-semibold text-ink">Socratic Flow</h3>
            <p className="mt-3 font-sans text-base leading-relaxed text-muted">
              Intent parsing, question curation, and aporia detection keep the dialogue nimble while reinforcing conceptual understanding.
            </p>
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-paper/90 p-6 shadow-sm backdrop-blur">
            <h3 className="text-2xl font-semibold text-ink">Multimodal Space</h3>
            <p className="mt-3 font-sans text-base leading-relaxed text-muted">
              Students collaborate through chat, voice, and whiteboard — all synced in real time for classrooms or small cohorts.
            </p>
          </article>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-paper/80 p-6 font-sans text-sm text-muted">
          <p>
            Ready to build? Follow the roadmap in <code>docs/Meno_Roadmap_PRs.md</code> and iterate PR by PR. Start with foundational UI primitives before wiring OCR, dialogue orchestration, and realtime collaboration.
          </p>
        </section>
      </main>

      <footer className="flex flex-col gap-1 pb-4 pt-6 font-sans text-sm text-muted">
        <span>Inspired by Plato’s dialogue.</span>
        <span>© {new Date().getFullYear()} Project Meno.</span>
      </footer>
    </div>
  );
}
