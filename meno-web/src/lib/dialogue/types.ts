export type TurnOutcome = "productive" | "unproductive" | "inconclusive";

export interface StudentTurnFeedback {
  outcome: TurnOutcome;
  content?: string;
}

export interface DialogueRecap {
  summary: string;
  highlights: string[];
  nextFocus?: string;
}

export interface DialogueContextTurn {
  role: "student" | "meno" | "system";
  content: string;
}

export interface DialogueTurnRequest {
  sessionId: string;
  planId: string;
  advance?: boolean;
  studentTurn?: StudentTurnFeedback;
  transcript?: DialogueContextTurn[];
  quickCheck?: QuickCheckResult;
  heavyCheck?: HeavyValidationRecord;
}

export type QuickCheckOutcome = "pass" | "fail" | "inconclusive";

export interface QuickCheckResult {
  outcome: QuickCheckOutcome;
  code: string;
  message?: string;
  severity?: "info" | "warning" | "error";
}

export interface HeavyValidationRecord {
  equivalent: boolean;
  unitsMatch: boolean;
  equivalenceDetail: string;
  unitsDetail?: string;
  timestamp: string;
  referenceExpression?: string;
  studentExpression?: string;
}

