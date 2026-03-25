import type {
  EmptyScenarioContext,
  ScenarioContext,
  ScenarioStep,
  ScenarioTest,
} from "./types.js";

function compose(steps: ScenarioStep<ScenarioContext, ScenarioContext>[], testFn: ScenarioTest<ScenarioContext>): (ctx: ScenarioContext) => Promise<void> {
  return async function run(ctx: ScenarioContext): Promise<void> {
    let index = -1;
    const dispatch = async (position: number, nextCtx: ScenarioContext): Promise<void> => {
      if (position <= index) {
        throw new Error("Scenario middleware called next() multiple times.");
      }
      index = position;

      const step = steps[position];
      if (!step) {
        await testFn(nextCtx);
        return;
      }

      await step(nextCtx, (updatedCtx) => dispatch(position + 1, updatedCtx));
    };

    await dispatch(0, ctx);
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
export function scenario(...parts: [...ScenarioStep[], ScenarioTest]): () => Promise<void> {
  const testFn = parts.at(-1);
  if (!testFn || typeof testFn !== "function") {
    throw new Error("scenario(...) requires a final async test function.");
  }

  const steps = parts.slice(0, -1) as ScenarioStep<ScenarioContext, ScenarioContext>[];
  const run = compose(steps, testFn as ScenarioTest<ScenarioContext>);

  return async () => {
    await run({});
  };
}
