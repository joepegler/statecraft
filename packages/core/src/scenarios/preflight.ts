import { StatecraftError } from "./errors.js";
import type { ActionPreflight, PreflightIssue } from "./actions.js";

export type PreflightSummary = {
  ok: boolean;
  failures: PreflightIssue[];
  assumptions: string[];
  estimatedEffects: Record<string, unknown>;
};

export function summarizePreflight(result: ActionPreflight): PreflightSummary {
  return {
    ok: result.canExecute,
    failures: result.reasons,
    assumptions: result.assumptions,
    estimatedEffects: result.estimatedEffects,
  };
}

export function assertPreflight(result: ActionPreflight): void {
  if (result.canExecute) {
    return;
  }
  throw new StatecraftError({
    code: "SC_PRECONDITION_FAILED",
    reason: "Action preflight failed.",
    context: {
      reasons: result.reasons,
      assumptions: result.assumptions,
      estimatedEffects: result.estimatedEffects,
    },
    suggestedAction: "Inspect preflight reasons and satisfy unmet assumptions before execute.",
  });
}
