export type TurnOutcome = "productive" | "unproductive" | "inconclusive";

export interface StudentTurnFeedback {
  outcome: TurnOutcome;
  content?: string;
}

