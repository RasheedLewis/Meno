"use client";

import { useMemo } from "react";

import { ChatPane } from "@/components/ChatPane/ChatPane";
import { ProblemHeader } from "@/components/Problem/ProblemHeader";
import { UploadBox } from "@/components/Problem/UploadBox";
import type { ProblemMeta } from "@/lib/types/problem";
import { useSessionStore } from "@/lib/store/session";
import type { HspPlan } from "@/lib/hsp/schema";

export default function ChatDemoPage() {
  const hspPlan = useSessionStore((state) => state.hspPlan);

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
        value: "The diagonal of the unit square has length $\sqrt{2}$.",
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
      "Ask what happens to area when each side is multiplied by $\sqrt{2}$.",
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
    if (!hspPlan) return demoProblem;
    return planToProblemMeta(hspPlan, demoProblem);
  }, [demoProblem, hspPlan]);

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
  const domain = (plan.meta?.domain as ProblemMeta["context"] | undefined)?.domain ?? fallback.context?.domain ?? "math";

  return {
    id: plan.problemId,
    title: (plan.meta?.title as string) ?? fallback.title,
    description: plan.summary ?? fallback.description,
    context: {
      domain: (domain as ProblemMeta["context"]["domain"]) ?? "math",
      difficulty: difficulty,
      source: (plan.meta?.source as string) ?? fallback.context?.source,
    },
    knowns: canonical
      ? [
          {
            label: "Canonical",
            value: canonical,
          },
        ]
      : fallback.knowns,
    unknowns: [
      {
        label: "To Demonstrate",
        value: plan.goal || fallback.goal,
      },
    ],
    goal: plan.goal || fallback.goal,
    hints:
      plan.steps.flatMap((step) => step.hints ?? []).length > 0
        ? plan.steps.flatMap((step) => step.hints ?? [])
        : fallback.hints,
    keywords: fallback.keywords,
    relatedConcepts: fallback.relatedConcepts,
    evaluation: fallback.evaluation,
    metadata: {
      ...fallback.metadata,
      updatedAt: plan.updatedAt ?? new Date().toISOString(),
    },
  };
};

