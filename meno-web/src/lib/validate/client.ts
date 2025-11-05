import type { HspStep } from "@/lib/hsp/schema";
import type { QuickCheckResult } from "@/lib/dialogue/types";

export type QuickCheckRule =
  | {
      type: "regex";
      pattern: string;
      flags?: string;
      message?: string;
    }
  | {
      type: "numeric";
      expected: number;
      tolerance?: number;
      message?: string;
    }
  | {
      type: "unit";
      units: string[];
      message?: string;
    };

export interface QuickCheckConfig {
  rules: QuickCheckRule[];
}

export const extractQuickCheckConfig = (step: HspStep | null): QuickCheckConfig | null => {
  if (!step?.check) return null;

  try {
    const parsed = typeof step.check === "string" ? JSON.parse(step.check) : step.check;
    if (!parsed) return null;
    if (Array.isArray(parsed)) {
      return { rules: normalizeRules(parsed) };
    }
    if (Array.isArray(parsed.rules)) {
      return { rules: normalizeRules(parsed.rules) };
    }
  } catch (error) {
    console.warn("Failed to parse step check configuration", error);
  }

  return null;
};

const normalizeRules = (rules: unknown[]): QuickCheckRule[] =>
  rules
    .map((rule) => {
      if (!rule || typeof rule !== "object") return null;
      const typed = rule as Partial<QuickCheckRule & { type: string }>;
      switch (typed.type) {
        case "regex":
          if (typeof typed.pattern === "string") {
            return {
              type: "regex" as const,
              pattern: typed.pattern,
              flags: typeof typed.flags === "string" ? typed.flags : undefined,
              message: typed.message,
            };
          }
          break;
        case "numeric":
          if (typeof typed.expected === "number") {
            return {
              type: "numeric" as const,
              expected: typed.expected,
              tolerance:
                typeof typed.tolerance === "number" && !Number.isNaN(typed.tolerance)
                  ? Math.abs(typed.tolerance)
                  : 1e-4,
              message: typed.message,
            };
          }
          break;
        case "unit":
          if (Array.isArray(typed.units)) {
            return {
              type: "unit" as const,
              units: typed.units
                .filter((unit) => typeof unit === "string" && unit.trim().length > 0)
                .map((unit) => unit.trim()),
              message: typed.message,
            };
          }
          break;
        default:
          break;
      }
      return null;
    })
    .filter((rule): rule is QuickCheckRule => Boolean(rule));

export const runQuickChecks = (
  answer: string,
  config: QuickCheckConfig | null,
): QuickCheckResult | null => {
  if (!config || config.rules.length === 0) {
    return null;
  }

  const trimmed = answer.trim();
  if (!trimmed) {
    return {
      outcome: "inconclusive",
      code: "empty",
      message: "Awaiting a response.",
      severity: "warning",
    };
  }

  for (const rule of config.rules) {
    switch (rule.type) {
      case "regex": {
        const regex = buildRegex(rule.pattern, rule.flags);
        if (!regex.test(trimmed)) {
          return {
            outcome: "fail",
            code: "regex_mismatch",
            message: rule.message ?? "That answer doesn’t match the expected form yet.",
            severity: "warning",
          };
        }
        break;
      }
      case "numeric": {
        const numeric = parseNumeric(trimmed);
        if (numeric === null) {
          return {
            outcome: "fail",
            code: "numeric_parse_error",
            message: rule.message ?? "I’m looking for a numeric value.",
            severity: "warning",
          };
        }
        const delta = Math.abs(numeric - rule.expected);
        if (delta > (rule.tolerance ?? 1e-4)) {
          return {
            outcome: "fail",
            code: "numeric_mismatch",
            message:
              rule.message ??
              `That isn’t quite aligned yet. Compare it to ${rule.expected} (±${rule.tolerance ?? 1e-4}).`,
            severity: "warning",
          };
        }
        break;
      }
      case "unit": {
        const match = rule.units.some((unit) =>
          new RegExp(`(^|\s)${escapeRegex(unit)}($|\s)`, "i").test(trimmed),
        );
        if (!match) {
          return {
            outcome: "fail",
            code: "unit_mismatch",
            message: rule.message ?? `Make sure to include the correct units (${rule.units.join(", ")}).`,
            severity: "warning",
          };
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    outcome: "pass",
    code: "quick_check_pass",
    message: "Looks consistent so far.",
    severity: "info",
  };
};

const buildRegex = (pattern: string, flags?: string) => {
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    console.warn("Invalid regex pattern", pattern, error);
    return new RegExp(".*");
  }
};

const parseNumeric = (value: string): number | null => {
  const numericMatch = value.replace(/[^0-9+\-./eE]/g, "").match(/[+\-]?\d*\.?\d+(?:[eE][+\-]?\d+)?/);
  if (!numericMatch) return null;
  const parsed = Number(numericMatch[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

