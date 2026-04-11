export type StatecraftErrorCode =
  | "SC_CONTEXT_MISSING"
  | "SC_CONSTRAINT_VIOLATION"
  | "SC_PRECONDITION_FAILED"
  | "SC_RUNTIME_START_TIMEOUT"
  | "SC_RUNTIME_START_FAILED"
  | "SC_RUNTIME_PORT_ALLOCATION_FAILED"
  | "SC_BUNDLER_UNSUPPORTED_MODE"
  | "SC_BUNDLER_START_FAILED";

export type StatecraftErrorDetails = Record<string, unknown>;

export type StatecraftErrorInput = {
  code: StatecraftErrorCode;
  reason: string;
  context?: StatecraftErrorDetails;
  suggestedAction?: string;
  cause?: unknown;
};

/**
 * Structured SDK error designed for automated remediation and branching.
 */
export class StatecraftError extends Error {
  readonly code: StatecraftErrorCode;
  readonly reason: string;
  readonly context: StatecraftErrorDetails;
  readonly suggestedAction?: string;

  constructor(input: StatecraftErrorInput) {
    super(input.reason, input.cause !== undefined ? { cause: input.cause } : undefined);
    this.name = "StatecraftError";
    this.code = input.code;
    this.reason = input.reason;
    this.context = input.context ?? {};
    this.suggestedAction = input.suggestedAction;
  }
}

export function isStatecraftError(value: unknown): value is StatecraftError {
  return value instanceof StatecraftError;
}

export function toStatecraftError(error: unknown, fallback: Omit<StatecraftErrorInput, "cause">): StatecraftError {
  if (isStatecraftError(error)) {
    return error;
  }
  return new StatecraftError({
    ...fallback,
    cause: error,
  });
}
