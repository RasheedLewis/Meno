import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <section className="space-y-6">
        <h2 className="text-4xl font-semibold leading-tight text-ink">
          Guided by questions, powered by dialogue.
        </h2>
        <p className="max-w-2xl font-sans text-lg leading-relaxed text-muted">
          Meno helps students unpack mathematics through Socratic conversation,
          collaborative whiteboarding, and a hidden solution plan that keeps every
          prompt purposeful.
        </p>
        <div className="flex flex-wrap gap-4 font-sans text-sm uppercase tracking-[0.3em] text-accent/80">
          <span>Dialogue First</span>
          <span>Voice + Captions</span>
          <span>Shared Canvas</span>
          <span>Hidden Solution Plan</span>
        </div>
        <div>
          <Link
            href="/ui"
            className="inline-flex items-center gap-2 font-sans text-sm text-accent underline-offset-4 transition hover:underline"
          >
            Preview the UI primitives
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-xl border border-[var(--border)] bg-paper/90 p-6 shadow-sm backdrop-blur">
          <h3 className="text-2xl font-semibold text-ink">Socratic Flow</h3>
          <p className="mt-3 font-sans text-base leading-relaxed text-muted">
            Intent parsing, question curation, and aporia detection keep the
            dialogue nimble while reinforcing conceptual understanding.
          </p>
        </article>
        <article className="rounded-xl border border-[var(--border)] bg-paper/90 p-6 shadow-sm backdrop-blur">
          <h3 className="text-2xl font-semibold text-ink">Multimodal Space</h3>
          <p className="mt-3 font-sans text-base leading-relaxed text-muted">
            Students collaborate through chat, voice, and whiteboard — all synced
            in real time for classrooms or small cohorts.
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-paper/80 p-6 font-sans text-sm text-muted">
        <p>
          Ready to build? Follow the roadmap in <code>docs/Meno_Roadmap_PRs.md</code>{" "}
          and iterate PR by PR. Start with foundational UI primitives before
          wiring OCR, dialogue orchestration, and realtime collaboration.
        </p>
      </section>
    </div>
  );
}
