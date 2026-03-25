import { describe, expect, test, vi } from "vitest";
import type { Hex } from "viem";
import { scenario } from "./scenario.js";
import type { EmptyScenarioContext, ScenarioContext, ScenarioStep } from "./types.js";

describe("scenario composition", () => {
  test("runs steps in declared order and passes context", async () => {
    const order: string[] = [];

    type WithWallet = ScenarioContext & { wallet: Hex };

    const stepA: ScenarioStep<EmptyScenarioContext, WithWallet> = async (ctx, next) => {
      order.push("a:before");
      await next({ ...ctx, wallet: "0xabc" as Hex });
      order.push("a:after");
    };

    const stepB: ScenarioStep<WithWallet, WithWallet> = async (ctx, next) => {
      order.push(`b:${ctx.wallet}`);
      await next(ctx);
    };

    const fn = vi.fn(async () => {
      order.push("test");
    });

    await scenario(stepA, stepB, fn)();

    expect(order).toEqual(["a:before", "b:0xabc", "test", "a:after"]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("throws if a step calls next twice", async () => {
    const badStep: ScenarioStep<ScenarioContext, ScenarioContext> = async (ctx, next) => {
      await next(ctx);
      await next(ctx);
    };

    await expect(
      scenario(badStep, async () => {
        // noop
      })(),
    ).rejects.toThrow("next() multiple times");
  });
});
