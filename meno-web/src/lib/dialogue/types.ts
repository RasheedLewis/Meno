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

