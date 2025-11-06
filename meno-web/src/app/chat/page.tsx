"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ChatPane } from "@/components/ChatPane/ChatPane";
import { ProblemHeader } from "@/components/Problem/ProblemHeader";
import { UploadBox } from "@/components/Problem/UploadBox";
import { Whiteboard } from "@/components/Whiteboard/Whiteboard";
import { Sheet } from "@/components/ui/Sheet";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { ProblemMeta } from "@/lib/types/problem";
import { useSessionStore } from "@/lib/store/session";
import type { HspPlan } from "@/lib/hsp/schema";

export default function ChatDemoPage() {
  const hspPlan = useSessionStore((state) => state.hspPlan);
  const hspPlanId = useSessionStore((state) => state.hspPlanId);
  const setHspPlan = useSessionStore((state) => state.setHspPlan);
  const sessionCode = useSessionStore((state) => state.sessionCode);

  const [elapsed, setElapsed] = useState("00:00");
  const [problemOpen, setProblemOpen] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const start = Date.now();
    const interval = window.setInterval(() => {
      const diff = Date.now() - start;
      const minutes = Math.floor(diff / 60000)
        .toString()
        .padStart(2, "0");
      const seconds = Math.floor((diff % 60000) / 1000)
        .toString()
        .padStart(2, "0");
      setElapsed(`${minutes}:${seconds}`);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hspPlanId || hspPlan) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/hsp?id=${hspPlanId}`);
        if (!response.ok) {
          console.warn("Failed to hydrate plan", await response.text());
          return;
        }
        const payload = await response.json();
        if (!cancelled && payload?.ok) {
          setHspPlan(payload.data);
        }
      } catch (error) {
        console.error("Plan hydration failed", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hspPlanId, hspPlan, setHspPlan]);

  const demoProblem: ProblemMeta = useMemo(
    () => ({
      id: "pythagorean-recollection",
      title: "Doubling the Square",
      description:
        "A young learner is asked to find the side of a square whose area is double that of a given square.",
      context: {
        domain: "math",
        difficulty: "intermediate",
        source: "Meno 82b-85b",
      },
      knowns: [
        {
          label: "Given",
          value: "A unit square with side length $1$ has area $1$.",
        },
        {
          label: "Construction",
          value: "The diagonal of the unit square has length $\\sqrt{2}$.",
        },
      ],
      unknowns: [
        {
          label: "To Find",
          value: "The side length $s$ such that $s^2 = 2$.",
        },
        {
          label: "Verification",
          value: "Show that constructing a square on the diagonal doubles the area.",
        },
      ],
      goal: "Guide the learner to see that the diagonal furnishes the side of the double-area square.",
      hints: [
        "Compare the areas formed by arranging the original squares around the diagonal.",
        "Ask what happens to area when each side is multiplied by $\\sqrt{2}$.",
      ],
      keywords: ["recollection", "geometry", "square"],
      relatedConcepts: ["Proportion", "Diagonal", "Area"],
      evaluation: {
        rubric: "Learner articulates why the diagonal yields the double-area square without memorized formulas.",
        metrics: {
          reasoning: 4,
          precision: 3,
        },
      },
      metadata: {
        author: "Socratic Demo",
        createdAt: "2024-07-12T00:00:00Z",
      },
    }),
    [],
  );

  const activeProblem = useMemo<ProblemMeta>(() => {
    if (!hspPlan) {
      return demoProblem;
    }
    return planToProblemMeta(hspPlan, demoProblem);
  }, [hspPlan, demoProblem]);

  const handleUploadToggle = () => {
    setProblemOpen(true);
    setUploadOpen((value) => !value);
  };

  return (
    <div className="relative flex min-h-screen w-full justify-center bg-[var(--surface)]">
      <Whiteboard className="fixed inset-0" />

      <TopBar
        problem={activeProblem}
        sessionCode={sessionCode}
        elapsed={elapsed}
        problemOpen={problemOpen}
        onToggleProblem={() => {
          setProblemOpen((value) => {
            const next = !value;
            if (!next) {
              setUploadOpen(false);
            }
            return next;
          });
        }}
        onUpload={() => setUploadOpen(true)}
      />

      <div className="pointer-events-none h-full w-full">
        <div className="pointer-events-auto pt-[96px]">
          <ProblemPanel
            problem={activeProblem}
            open={problemOpen}
            onClose={() => setProblemOpen(false)}
          />
        </div>
      </div>

      <UploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} />

      <ChatToggle open={chatOpen} onToggle={() => setChatOpen((value) => !value)} />
      {chatOpen ? <ChatDrawer onClose={() => setChatOpen(false)} /> : null}
    </div>
  );
}

type ProblemDomain = NonNullable<ProblemMeta["context"]>["domain"];

type TopBarProps = {
  problem: ProblemMeta;
  sessionCode: string | null;
  elapsed: string;
  problemOpen: boolean;
  onToggleProblem: () => void;
  onUpload: () => void;
};

function TopBar({ problem, sessionCode, elapsed, problemOpen, onToggleProblem, onUpload }: TopBarProps) {
  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-30 flex justify-center">
      <div className="pointer-events-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-b-3xl border-b border-[var(--border)] bg-[var(--card)]/95 px-5 py-3 shadow-strong backdrop-blur">
        <ProblemTitleTile problem={problem} open={problemOpen} onToggle={onToggleProblem} />
        <SessionStatusTile sessionCode={sessionCode} elapsed={elapsed} />
        <div className="flex items-center gap-3">
          <UploadButtonTile onUpload={onUpload} />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

function ProblemTitleTile({ problem, open, onToggle }: { problem: ProblemMeta; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="max-w-[50vw] text-left transition hover:opacity-90"
    >
      <span className="text-[11px] font-sans uppercase tracking-[0.3em] text-[var(--muted)]">Problem</span>
      <div className="font-serif text-lg leading-snug text-[var(--accent)]">{problem.title}</div>
      <span className="font-sans text-xs text-[var(--muted)]">ID: {problem.id}</span>
      <span className="ml-2 font-sans text-xs text-[var(--muted)]">{open ? "(Hide)" : "(Show)"}</span>
    </button>
  );
}

function SessionStatusTile({ sessionCode, elapsed }: { sessionCode: string | null; elapsed: string }) {
  const codeDisplay = sessionCode ?? "----";
  return (
    <div className="flex flex-col items-center justify-center gap-1 font-sans text-sm text-[var(--muted)]">
      <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--paper)]/90 px-4 py-1.5">
        <span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Session</span>
        <span className="font-semibold text-[var(--accent)]">{codeDisplay}</span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--paper)]/90 px-3 py-1.5">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
        <span>{elapsed}</span>
      </div>
    </div>
  );
}

function UploadButtonTile({ onUpload }: { onUpload: () => void }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="rounded-full px-5"
      onClick={onUpload}
    >
      Upload Image
    </Button>
  );
}

function ChatToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom)+1rem)] left-[max(1.25rem,env(safe-area-inset-left)+1rem)] z-20 flex translate-x-[6.5rem] gap-3">
      <Button
        variant="ghost"
        size="sm"
        className="pointer-events-auto rounded-2xl bg-[var(--card)]/90 px-4 py-2 shadow-strong backdrop-blur"
        onClick={onToggle}
      >
        {open ? "Hide Chat" : "Open Chat"}
      </Button>
    </div>
  );
}

function ChatDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-8">
      <div className="w-full max-w-4xl rounded-3xl border border-[var(--border)] bg-[var(--paper)]/95 p-4 shadow-strong backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-[var(--ink)]">Dialogue</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-4">
          <ChatPane className="w-full" />
        </div>
      </div>
    </div>
  );
}

function ProblemPanel({ problem, open, onClose }: { problem: ProblemMeta; open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed top-24 right-6 z-20 w-[min(26rem,90vw)] max-h-[70vh] overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--paper)]/95 p-5 shadow-strong backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-[var(--ink)]">{problem.title}</h2>
          <p className="mt-1 font-sans text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Active Problem</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="mt-4">
        <ProblemHeader meta={problem} />
      </div>
    </div>
  );
}

function UploadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} widthClass="w-full max-w-md">
      <div className="flex flex-col gap-4 p-6">
        <header>
          <h2 className="font-serif text-lg text-[var(--ink)]">Upload Problem Image</h2>
          <p className="font-sans text-sm text-[var(--muted)]">Drop a screenshot or scan to extract the canonical statement.</p>
        </header>
        <UploadBox className="w-full" />
        <Button variant="ghost" size="sm" className="self-end" onClick={onClose}>
          Close
        </Button>
      </div>
    </Sheet>
  );
}

const planToProblemMeta = (plan: HspPlan, fallback: ProblemMeta): ProblemMeta => {
  const canonical = typeof plan.meta?.canonicalText === "string" ? plan.meta.canonicalText : undefined;
  const difficulty = fallback.context?.difficulty;
  const rawDomain = plan.meta?.domain;
  const domain = isProblemDomain(rawDomain) ? rawDomain : fallback.context?.domain ?? "math";
  const derivedTitle = deriveTitle(plan) ?? fallback.title;
  const description = plan.summary ?? fallback.description;
  const goal = plan.goal || fallback.goal;
  const canonicalKnowns = canonical ? splitCanonical(canonical) : null;
  const hints = collectHints(plan, fallback.hints);

  return {
    id: plan.problemId,
    title: derivedTitle,
    description,
    context: {
      domain,
      difficulty,
      source: (plan.meta?.source as string) ?? fallback.context?.source,
    },
    knowns:
      canonicalKnowns?.length
        ? canonicalKnowns.map((value, index) => ({
            label: index === 0 ? "Canonical" : `Detail ${index}`,
            value,
          }))
        : fallback.knowns,
    unknowns: [
      {
        label: "To Demonstrate",
        value: goal,
      },
      ...deriveUnknownsFromSteps(plan),
    ],
    goal,
    hints,
    keywords: mergeStringArrays(fallback.keywords, plan.meta?.keywords as string[] | undefined),
    relatedConcepts: mergeStringArrays(
      fallback.relatedConcepts,
      plan.meta?.relatedConcepts as string[] | undefined,
    ),
    evaluation: plan.meta?.evaluation
      ? {
          rubric: (plan.meta.evaluation as { rubric?: string })?.rubric ?? fallback.evaluation?.rubric,
          metrics: (plan.meta.evaluation as { metrics?: Record<string, number> })?.metrics ?? fallback.evaluation?.metrics,
        }
      : fallback.evaluation,
    metadata: {
      ...fallback.metadata,
      updatedAt: plan.updatedAt ?? new Date().toISOString(),
      sourcePlanId: plan.id,
    },
  };
};

const isProblemDomain = (value: unknown): value is ProblemDomain =>
  typeof value === "string" && ["philosophy", "math", "logic", "language", "custom"].includes(value);

const deriveTitle = (plan: HspPlan) => {
  const meta = plan.meta ?? {};

  const primary = stringOrNull(meta.title) ?? stringOrNull(meta.lessonTitle) ?? stringOrNull(meta.topic);
  if (primary) {
    return truncate(toTitle(primary), 72);
  }

  const keywords = Array.isArray(meta.keywords) ? (meta.keywords as string[]) : [];
  const keywordTitle = keywords.find((word) => typeof word === "string" && word.trim().length > 0);
  if (keywordTitle) {
    return truncate(toTitle(keywordTitle), 72);
  }

  const canonicalTitle = typeof meta.canonicalText === "string" ? buildTitleFromCanonical(meta.canonicalText) : null;
  if (canonicalTitle) {
    return truncate(canonicalTitle, 72);
  }

  return null;
};

const stringOrNull = (value: unknown) => (typeof value === "string" ? value.trim() || null : null);

const truncate = (value: string, max: number) =>
  value.length <= max ? value : value.slice(0, max - 1).trimEnd() + "…";

const splitCanonical = (canonical: string) =>
  canonical
    .split(/(?:\r?\n){2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

const collectHints = (plan: HspPlan, fallbackHints?: string[]) => {
  const planHints = plan.steps.flatMap((step) => step.hints ?? []);
  if (planHints.length > 0) {
    return planHints;
  }
  return fallbackHints;
};

const deriveUnknownsFromSteps = (plan: HspPlan) =>
  plan.steps.map((step) => ({
    label: step.title,
    value: step.prompt,
  }));

const mergeStringArrays = (primary?: string[], secondary?: string[]) => {
  const merged = new Set<string>();
  (primary ?? []).forEach((item) => merged.add(item));
  (secondary ?? []).forEach((item) => merged.add(item));
  return Array.from(merged);
};

const toTitle = (value: string) =>
  value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      return lower.replace(/^[a-z]|(?<=\b[a-z]{1,3})'[a-z]|(\b[a-z])/g, (segment, _single, apostrophe, boundary) => {
        if (apostrophe) {
          return apostrophe.toUpperCase();
        }
        if (boundary) {
          return boundary.toUpperCase();
        }
        return segment.toUpperCase();
      });
    })
    .join(" ");

const buildTitleFromCanonical = (canonical: string) => {
  const sanitized = canonical.replace(/^[\s\n]*plain\s*text\s*[:\-]?\s*/i, "");
  const cleaned = sanitized
    .replace(/\$[^$]*\$/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase();

  const stopwords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "to",
    "in",
    "with",
    "for",
    "on",
    "by",
    "is",
    "are",
    "has",
    "have",
    "that",
    "this",
    "these",
    "those",
    "which",
    "through",
    "both",
    "use",
    "using",
    "given",
    "let",
    "such",
    "as",
    "plain",
    "text",
    "output",
    "problem",
    "statement",
  ]);

  const words = cleaned
    .split(/\s+/)
    .filter((word) => word && !stopwords.has(word))
    .slice(0, 4);

  if (words.length === 0) {
    return null;
  }

  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

