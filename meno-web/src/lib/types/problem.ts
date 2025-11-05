export interface ProblemMeta {
  id: string;
  title: string;
  description?: string;
  context?: {
    domain: "philosophy" | "math" | "logic" | "language" | "custom";
    difficulty?: number | "introductory" | "intermediate" | "advanced";
    source?: string;
  };
  knowns: Array<{
    label: string;
    value: string;
  }>;
  unknowns: Array<{
    label: string;
    value: string;
  }>;
  goal: string;
  hints?: string[];
  keywords?: string[];
  relatedConcepts?: string[];
  evaluation?: {
    rubric?: string;
    metrics?: Record<string, number>;
  };
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    author?: string;
    sourcePlanId?: string;
  };
}

