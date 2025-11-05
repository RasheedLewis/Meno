import type { ErrorCategory, HeavyValidationRecord, QuickCheckResult } from "@/lib/dialogue/types";

const ORDER: ErrorCategory[] = ["algebraic", "arithmetic", "units"];

const categorizeQuickCheck = (check: QuickCheckResult): ErrorCategory[] => {
  if (check.outcome !== "fail") {
    return [];
  }

  const code = check.code.toLowerCase();
  const categories = new Set<ErrorCategory>();

  if (code.includes("unit")) {
    categories.add("units");
  }
  if (code.includes("numeric") || code.includes("arith")) {
    categories.add("arithmetic");
  }
  if (code.includes("sympy") || code.includes("regex") || code.includes("algebra")) {
    categories.add("algebraic");
  }

  return Array.from(categories);
};

const categorizeHeavyValidation = (record: HeavyValidationRecord): ErrorCategory[] => {
  const categories = new Set<ErrorCategory>();
  if (!record.equivalent) {
    categories.add("algebraic");
  }
  if (!record.unitsMatch) {
    categories.add("units");
  }
  return Array.from(categories);
};

export const deriveErrorCategories = (
  quickChecks: QuickCheckResult[],
  validations: HeavyValidationRecord[],
): ErrorCategory[] => {
  const categories = new Set<ErrorCategory>();

  quickChecks.forEach((check) => {
    categorizeQuickCheck(check).forEach((category) => categories.add(category));
  });

  validations.forEach((record) => {
    categorizeHeavyValidation(record).forEach((category) => categories.add(category));
  });

  return ORDER.filter((category) => categories.has(category));
};
