import { env } from "@/env";
import type { QuickCheckResult } from "@/lib/dialogue/types";

export interface HeavyCheckRequest {
  studentExpression: string;
  referenceExpression: string;
  expectedUnits?: string[];
  variables?: string[];
}

export interface HeavyCheckResult {
  equivalent: boolean;
  unitsMatch: boolean;
  equivalenceDetail: string;
  unitsDetail?: string;
}

export const runHeavyCheck = async (
  payload: HeavyCheckRequest,
): Promise<HeavyCheckResult> => {
  if (!env.SYMPY_SERVICE_URL) {
    throw new Error("SYMPY_SERVICE_URL is not configured");
  }

  const response = await fetch(`${env.SYMPY_SERVICE_URL}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      student_expression: payload.studentExpression,
      reference_expression: payload.referenceExpression,
      expected_units: payload.expectedUnits,
      variables: payload.variables,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "SymPy validation failed");
  }

  const data = (await response.json()) as {
    equivalent: boolean;
    units_match: boolean;
    equivalence_detail: string;
    units_detail?: string;
  };

  return {
    equivalent: data.equivalent,
    unitsMatch: data.units_match,
    equivalenceDetail: data.equivalence_detail,
    unitsDetail: data.units_detail,
  };
};

export const heavyResultToQuickCheck = (result: HeavyCheckResult): QuickCheckResult => {
  if (result.equivalent && result.unitsMatch) {
    return {
      outcome: "pass",
      code: "sympy_pass",
      message: "Validated by SymPy.",
      severity: "info",
    };
  }

  if (!result.equivalent) {
    return {
      outcome: "fail",
      code: "sympy_mismatch",
      message: result.equivalenceDetail,
      severity: "warning",
    };
  }

  return {
    outcome: "fail",
    code: "unit_mismatch",
    message: result.unitsDetail ?? "Units need adjustment.",
    severity: "warning",
  };
};
