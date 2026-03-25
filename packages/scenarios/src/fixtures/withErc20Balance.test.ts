import { describe, expect, test } from "vitest";
import { withErc20Balance } from "./withErc20Balance.js";

const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0ce3606eB48" as const;

describe("withErc20Balance", () => {
  test("throws when recipient is missing", async () => {
    const step = withErc20Balance({
      token: USDC_MAINNET,
      amount: 1n,
    });

    const ctx = {
      runtime: { rpcUrl: "http://127.0.0.1:8545" },
      publicClient: {},
      walletClient: {},
      testClient: { mode: "anvil" },
    } as any;

    await expect(
      step(ctx, async () => {
        throw new Error("next should not run");
      }),
    ).rejects.toThrow(/recipient/i);
  });
});
