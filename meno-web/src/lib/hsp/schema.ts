export type TaxonomyKey = "definitional" | "analytical" | "proportional" | "spectral" | "evaluative";

export interface OcrUploadRecord {
  id: string;
  fileName: string;
  canonicalText: string;
  plainText: string;
  latex?: string;
  imageBase64?: string;
  uploadedAt: string;
}

export interface HspStep {
  id: string;
  title: string;
  prompt: string;
  check?: string;
  hints?: string[];
  tags?: string[];
  dependencies?: string[];
  taxonomy?: TaxonomyKey;
}

export interface HspPlan {
  id: string;
  problemId: string;
  sessionId: string;
  goal: string;
  summary?: string;
  createdAt: string;
  updatedAt?: string;
  steps: HspStep[];
  meta?: Record<string, unknown> & {
    canonicalText?: string;
    uploads?: OcrUploadRecord[];
  };
}

export interface GenerateHspInput {
  canonicalText: string;
  goal?: string;
  sessionId: string;
  problemId: string;
}

export interface GenerateHspResult {
  plan: HspPlan;
}

