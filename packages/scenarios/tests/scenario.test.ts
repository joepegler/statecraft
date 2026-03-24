import { describe, expect, test, vi } from "vitest";
import { scenario } from "../src/scenario";
import type { ScenarioStep } from "../src/types";

describe("scenario composition", () => {
  test("runs steps in declared order and passes context", async () => {
    const order: string[] = [];

    const stepA: ScenarioStep = async (ctx, next) => {
      order.push("a:before");
      await next({ ...ctx, wallet: "0xabc" });
      order.push("a:after");
    };

    const stepB: ScenarioStep = async (ctx, next) => {
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
    const badStep: ScenarioStep = async (ctx, next) => {
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
