import { ChatPane } from "@/components/ChatPane/ChatPane";
import { ProblemHeader } from "@/components/Problem/ProblemHeader";
import { UploadBox } from "@/components/Problem/UploadBox";
import type { ProblemMeta } from "@/lib/types/problem";

export default function ChatDemoPage() {
  const demoProblem: ProblemMeta = {
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
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <ProblemHeader meta={demoProblem} className="w-full max-w-3xl" />
      <ChatPane className="w-full max-w-3xl" />
      <UploadBox className="w-full max-w-3xl" />
    </div>
  );
}

