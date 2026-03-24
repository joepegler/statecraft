import type { ScenarioContext, ScenarioStep, ScenarioTest } from "./types";

function compose(steps: ScenarioStep[], testFn: ScenarioTest): (ctx: ScenarioContext) => Promise<void> {
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
 */
export function scenario(...parts: [...ScenarioStep[], ScenarioTest]): () => Promise<void> {
  const testFn = parts.at(-1);
  if (!testFn || typeof testFn !== "function") {
    throw new Error("scenario(...) requires a final async test function.");
  }

  const steps = parts.slice(0, -1) as ScenarioStep[];
  const run = compose(steps, testFn as ScenarioTest);

  return async () => {
    await run({});
  };
}
