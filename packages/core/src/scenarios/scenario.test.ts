import { describe, expect, test, vi } from "vitest";
import type { Hex } from "viem";
import { scenario } from "./scenario.js";
import type { EmptyScenarioContext, ScenarioContext, ScenarioStep } from "./types.js";
import { StatecraftError } from "./errors.js";

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
    ).rejects.toBeInstanceOf(StatecraftError);
  });

  test("emits step-level tracing hooks", async () => {
    const onStepStart = vi.fn();
    const onStepSuccess = vi.fn();
    const onStepFailure = vi.fn();
    const onCleanup = vi.fn();

    const stepA: ScenarioStep<EmptyScenarioContext, ScenarioContext & { wallet: Hex }> = async (ctx, next) => {
      await next({ ...ctx, wallet: "0xabc" as Hex });
    };
    const stepB: ScenarioStep<ScenarioContext & { wallet: Hex }, ScenarioContext & { wallet: Hex }> = async (ctx, next) => {
      await next({ ...ctx, chains: {} as any });
    };

    await scenario(
      {
        options: {
          onStepStart,
          onStepSuccess,
          onStepFailure,
          onCleanup,
        },
      },
      stepA,
      stepB,
      async () => {
        // noop
      },
    )();

    expect(onStepStart).toHaveBeenCalledTimes(2);
    expect(onStepSuccess).toHaveBeenCalledTimes(2);
    expect(onStepFailure).not.toHaveBeenCalled();
    expect(onCleanup).toHaveBeenCalledTimes(1);
    const deltaKeys = onStepSuccess.mock.calls[0]?.[0]?.contextDeltaKeys as string[];
    expect(deltaKeys.some((k) => k.includes("wallet"))).toBe(true);
  });
});
