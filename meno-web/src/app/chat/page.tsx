"use client";

import { useEffect, useMemo } from "react";

import { ChatPane } from "@/components/ChatPane/ChatPane";
import { ProblemHeader } from "@/components/Problem/ProblemHeader";
import { UploadBox } from "@/components/Problem/UploadBox";
import type { ProblemMeta } from "@/lib/types/problem";
import { useSessionStore } from "@/lib/store/session";
import type { HspPlan } from "@/lib/hsp/schema";

export default function ChatDemoPage() {
  const hspPlan = useSessionStore((state) => state.hspPlan);
  const hspPlanId = useSessionStore((state) => state.hspPlanId);
  const setHspPlan = useSessionStore((state) => state.setHspPlan);

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

  return (
    <div className="flex flex-col items-center gap-8">
      <ProblemHeader meta={activeProblem} className="w-full max-w-3xl" />
      <ChatPane className="w-full max-w-3xl" />
      <UploadBox className="w-full max-w-3xl" />
    </div>
  );
}

const planToProblemMeta = (plan: HspPlan, fallback: ProblemMeta): ProblemMeta => {
  const canonical = typeof plan.meta?.canonicalText === "string" ? plan.meta.canonicalText : undefined;
  const difficulty = fallback.context?.difficulty;
  const domain = (plan.meta?.domain as ProblemMeta["context"]["domain"] | undefined) ?? fallback.context?.domain ?? "math";
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
          metrics:
            (plan.meta.evaluation as { metrics?: Record<string, number> })?.metrics ?? fallback.evaluation?.metrics,
        }
      : fallback.evaluation,
    metadata: {
      ...fallback.metadata,
      updatedAt: plan.updatedAt ?? new Date().toISOString(),
      sourcePlanId: plan.id,
    },
  };
};

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
      return lower.replace(/^[a-z]|(?<=\b[a-z]{1,3})'[a-z]|(\b[a-z])/g, (segment, single, apostrophe, boundary) => {
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

