import type {
  EmptyScenarioContext,
  ScenarioContext,
  ScenarioStep,
  ScenarioTest,
} from "./types.js";
import { toStatecraftError, type StatecraftError } from "./errors.js";
import { getScenarioStepLabel } from "./stepMeta.js";

export type ScenarioStepEvent = {
  stepIndex: number;
  stepLabel: string;
  contextKeysBefore: string[];
};

export type ScenarioStepSuccessEvent = ScenarioStepEvent & {
  durationMs: number;
  contextDeltaKeys: string[];
};

export type ScenarioStepFailureEvent = ScenarioStepEvent & {
  durationMs: number;
  error: StatecraftError;
};

export type ScenarioCleanupEvent = {
  finalContextKeys: string[];
  error?: StatecraftError;
};

export type ScenarioRunOptions = {
  onStepStart?: (event: ScenarioStepEvent) => void;
  onStepSuccess?: (event: ScenarioStepSuccessEvent) => void;
  onStepFailure?: (event: ScenarioStepFailureEvent) => void;
  onCleanup?: (event: ScenarioCleanupEvent) => void;
};

type ScenarioConfigInput = {
  options?: ScenarioRunOptions;
};

function isScenarioConfigInput(value: unknown): value is ScenarioConfigInput {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (typeof value === "function") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return "options" in candidate;
}

function deriveStepLabel(step: ScenarioStep<ScenarioContext, ScenarioContext>, index: number): string {
  const labeled = getScenarioStepLabel(step);
  if (labeled) {
    return labeled;
  }
  return step.name?.trim() ? step.name : `step#${index + 1}`;
}

function diffContextKeys(previous: ScenarioContext, next: ScenarioContext): string[] {
  const previousKeys = new Set(Object.keys(previous));
  const nextKeys = new Set(Object.keys(next));
  const delta = new Set<string>();
  for (const key of previousKeys) {
    if (!nextKeys.has(key)) {
      delta.add(`-${key}`);
    }
  }
  for (const key of nextKeys) {
    if (!previousKeys.has(key)) {
      delta.add(`+${key}`);
    }
  }
  for (const key of nextKeys) {
    if (previousKeys.has(key) && previous[key as keyof ScenarioContext] !== next[key as keyof ScenarioContext]) {
      delta.add(`~${key}`);
    }
  }
  return [...delta];
}

function compose(
  steps: ScenarioStep<ScenarioContext, ScenarioContext>[],
  testFn: ScenarioTest<ScenarioContext>,
  options?: ScenarioRunOptions,
): (ctx: ScenarioContext) => Promise<void> {
  return async function run(ctx: ScenarioContext): Promise<void> {
    let index = -1;
    let lastContext = ctx;
    let terminalError: StatecraftError | undefined;
    const dispatch = async (position: number, nextCtx: ScenarioContext): Promise<void> => {
      if (position <= index) {
        throw new Error("Scenario middleware called next() multiple times.");
      }
      index = position;

      const step = steps[position];
      if (!step) {
        lastContext = nextCtx;
        await testFn(nextCtx);
        return;
      }

      const startedAt = Date.now();
      const stepLabel = deriveStepLabel(step, position);
      options?.onStepStart?.({
        stepIndex: position,
        stepLabel,
        contextKeysBefore: Object.keys(nextCtx),
      });
      try {
        await step(nextCtx, async (updatedCtx) => {
          options?.onStepSuccess?.({
            stepIndex: position,
            stepLabel,
            durationMs: Date.now() - startedAt,
            contextKeysBefore: Object.keys(nextCtx),
            contextDeltaKeys: diffContextKeys(nextCtx, updatedCtx),
          });
          lastContext = updatedCtx;
          await dispatch(position + 1, updatedCtx);
        });
      } catch (error) {
        const normalized = toStatecraftError(error, {
          code: "SC_PRECONDITION_FAILED",
          reason: `Scenario step "${stepLabel}" failed.`,
          context: { stepIndex: position, stepLabel },
          suggestedAction: "Inspect the nested cause and scenario step order.",
        });
        terminalError = normalized;
        options?.onStepFailure?.({
          stepIndex: position,
          stepLabel,
          durationMs: Date.now() - startedAt,
          contextKeysBefore: Object.keys(nextCtx),
          error: normalized,
        });
        throw normalized;
      }
    };

    try {
      await dispatch(0, ctx);
    } finally {
      options?.onCleanup?.({
        finalContextKeys: Object.keys(lastContext),
        error: terminalError,
      });
    }
  };
}

/**
 * Composes scenario middleware (`withX` steps) and a final test: returns an async runner that starts from `{}`.
 * The last argument must be the test function; earlier arguments are steps applied in order.
 *
 * When steps use typed {@link ScenarioStep} fixtures, the test callback’s `ctx` is inferred as the accumulated context.
 */
export function scenario(test: ScenarioTest<ScenarioContext>): () => Promise<void>;
export function scenario<O1 extends ScenarioContext>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  test: ScenarioTest<O1>,
): () => Promise<void>;
export function scenario<O1 extends ScenarioContext, O2 extends ScenarioContext>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  s2: ScenarioStep<O1, O2>,
  test: ScenarioTest<O2>,
): () => Promise<void>;
export function scenario<O1 extends ScenarioContext, O2 extends ScenarioContext, O3 extends ScenarioContext>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  s2: ScenarioStep<O1, O2>,
  s3: ScenarioStep<O2, O3>,
  test: ScenarioTest<O3>,
): () => Promise<void>;
export function scenario<
  O1 extends ScenarioContext,
  O2 extends ScenarioContext,
  O3 extends ScenarioContext,
  O4 extends ScenarioContext,
>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  s2: ScenarioStep<O1, O2>,
  s3: ScenarioStep<O2, O3>,
  s4: ScenarioStep<O3, O4>,
  test: ScenarioTest<O4>,
): () => Promise<void>;
export function scenario<
  O1 extends ScenarioContext,
  O2 extends ScenarioContext,
  O3 extends ScenarioContext,
  O4 extends ScenarioContext,
  O5 extends ScenarioContext,
>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  s2: ScenarioStep<O1, O2>,
  s3: ScenarioStep<O2, O3>,
  s4: ScenarioStep<O3, O4>,
  s5: ScenarioStep<O4, O5>,
  test: ScenarioTest<O5>,
): () => Promise<void>;
export function scenario<
  O1 extends ScenarioContext,
  O2 extends ScenarioContext,
  O3 extends ScenarioContext,
  O4 extends ScenarioContext,
  O5 extends ScenarioContext,
  O6 extends ScenarioContext,
>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  s2: ScenarioStep<O1, O2>,
  s3: ScenarioStep<O2, O3>,
  s4: ScenarioStep<O3, O4>,
  s5: ScenarioStep<O4, O5>,
  s6: ScenarioStep<O5, O6>,
  test: ScenarioTest<O6>,
): () => Promise<void>;
export function scenario<
  O1 extends ScenarioContext,
  O2 extends ScenarioContext,
  O3 extends ScenarioContext,
  O4 extends ScenarioContext,
  O5 extends ScenarioContext,
  O6 extends ScenarioContext,
  O7 extends ScenarioContext,
>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  s2: ScenarioStep<O1, O2>,
  s3: ScenarioStep<O2, O3>,
  s4: ScenarioStep<O3, O4>,
  s5: ScenarioStep<O4, O5>,
  s6: ScenarioStep<O5, O6>,
  s7: ScenarioStep<O6, O7>,
  test: ScenarioTest<O7>,
): () => Promise<void>;
export function scenario<
  O1 extends ScenarioContext,
  O2 extends ScenarioContext,
  O3 extends ScenarioContext,
  O4 extends ScenarioContext,
  O5 extends ScenarioContext,
  O6 extends ScenarioContext,
  O7 extends ScenarioContext,
  O8 extends ScenarioContext,
>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  s2: ScenarioStep<O1, O2>,
  s3: ScenarioStep<O2, O3>,
  s4: ScenarioStep<O3, O4>,
  s5: ScenarioStep<O4, O5>,
  s6: ScenarioStep<O5, O6>,
  s7: ScenarioStep<O6, O7>,
  s8: ScenarioStep<O7, O8>,
  test: ScenarioTest<O8>,
): () => Promise<void>;
export function scenario<
  O1 extends ScenarioContext,
  O2 extends ScenarioContext,
  O3 extends ScenarioContext,
  O4 extends ScenarioContext,
  O5 extends ScenarioContext,
  O6 extends ScenarioContext,
  O7 extends ScenarioContext,
  O8 extends ScenarioContext,
  O9 extends ScenarioContext,
>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  s2: ScenarioStep<O1, O2>,
  s3: ScenarioStep<O2, O3>,
  s4: ScenarioStep<O3, O4>,
  s5: ScenarioStep<O4, O5>,
  s6: ScenarioStep<O5, O6>,
  s7: ScenarioStep<O6, O7>,
  s8: ScenarioStep<O7, O8>,
  s9: ScenarioStep<O8, O9>,
  test: ScenarioTest<O9>,
): () => Promise<void>;
export function scenario<
  O1 extends ScenarioContext,
  O2 extends ScenarioContext,
  O3 extends ScenarioContext,
  O4 extends ScenarioContext,
  O5 extends ScenarioContext,
  O6 extends ScenarioContext,
  O7 extends ScenarioContext,
  O8 extends ScenarioContext,
  O9 extends ScenarioContext,
  O10 extends ScenarioContext,
>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  s2: ScenarioStep<O1, O2>,
  s3: ScenarioStep<O2, O3>,
  s4: ScenarioStep<O3, O4>,
  s5: ScenarioStep<O4, O5>,
  s6: ScenarioStep<O5, O6>,
  s7: ScenarioStep<O6, O7>,
  s8: ScenarioStep<O7, O8>,
  s9: ScenarioStep<O8, O9>,
  s10: ScenarioStep<O9, O10>,
  test: ScenarioTest<O10>,
): () => Promise<void>;
export function scenario<
  O1 extends ScenarioContext,
  O2 extends ScenarioContext,
  O3 extends ScenarioContext,
  O4 extends ScenarioContext,
  O5 extends ScenarioContext,
  O6 extends ScenarioContext,
  O7 extends ScenarioContext,
  O8 extends ScenarioContext,
  O9 extends ScenarioContext,
  O10 extends ScenarioContext,
  O11 extends ScenarioContext,
>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  s2: ScenarioStep<O1, O2>,
  s3: ScenarioStep<O2, O3>,
  s4: ScenarioStep<O3, O4>,
  s5: ScenarioStep<O4, O5>,
  s6: ScenarioStep<O5, O6>,
  s7: ScenarioStep<O6, O7>,
  s8: ScenarioStep<O7, O8>,
  s9: ScenarioStep<O8, O9>,
  s10: ScenarioStep<O9, O10>,
  s11: ScenarioStep<O10, O11>,
  test: ScenarioTest<O11>,
): () => Promise<void>;
export function scenario<
  O1 extends ScenarioContext,
  O2 extends ScenarioContext,
  O3 extends ScenarioContext,
  O4 extends ScenarioContext,
  O5 extends ScenarioContext,
  O6 extends ScenarioContext,
  O7 extends ScenarioContext,
  O8 extends ScenarioContext,
  O9 extends ScenarioContext,
  O10 extends ScenarioContext,
  O11 extends ScenarioContext,
  O12 extends ScenarioContext,
>(
  s1: ScenarioStep<EmptyScenarioContext, O1>,
  s2: ScenarioStep<O1, O2>,
  s3: ScenarioStep<O2, O3>,
  s4: ScenarioStep<O3, O4>,
  s5: ScenarioStep<O4, O5>,
  s6: ScenarioStep<O5, O6>,
  s7: ScenarioStep<O6, O7>,
  s8: ScenarioStep<O7, O8>,
  s9: ScenarioStep<O8, O9>,
  s10: ScenarioStep<O9, O10>,
  s11: ScenarioStep<O10, O11>,
  s12: ScenarioStep<O11, O12>,
  test: ScenarioTest<O12>,
): () => Promise<void>;
/** Fallback when custom steps use the default {@link ScenarioStep} shape (untyped pipeline). */
export function scenario(config: ScenarioConfigInput, ...parts: [...ScenarioStep[], ScenarioTest]): () => Promise<void>;
export function scenario(...rawParts: [ScenarioConfigInput, ...ScenarioStep[], ScenarioTest] | [...ScenarioStep[], ScenarioTest]): () => Promise<void> {
  const [config, parts] = isScenarioConfigInput(rawParts[0])
    ? [rawParts[0], rawParts.slice(1)]
    : [undefined, rawParts];
  const testFn = parts.at(-1);
  if (!testFn || typeof testFn !== "function") {
    throw new Error("scenario(...) requires a final async test function.");
  }

  const steps = parts.slice(0, -1) as ScenarioStep<ScenarioContext, ScenarioContext>[];
  const run = compose(steps, testFn as ScenarioTest<ScenarioContext>, config?.options);

  return async () => {
    await run({});
  };
}
