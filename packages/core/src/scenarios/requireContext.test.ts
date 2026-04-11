import { describe, expect, test } from "vitest";
import { requireContext } from "./utils.js";
import type { ScenarioContext } from "./types.js";
import type { Chain } from "viem";
import { StatecraftError } from "./errors.js";

describe("requireContext", () => {
  test("returns the same object when keys are present", () => {
    const chain = { id: 31337 } as Chain;
    const ctx: ScenarioContext = {
      chains: {
        default: {
          runtime: { key: "k", rpcUrl: "http://127.0.0.1:8545", stop: async () => {} },
          runtimeMode: "chain",
          chain,
          publicClient: {} as any,
          walletClient: {} as any,
          testClient: {} as any,
          wallet: "0x0000000000000000000000000000000000000001",
        },
      },
    };
    const narrowed = requireContext(ctx, "chains");
    expect(narrowed).toBe(ctx);
    expect(narrowed.chains).toBe(ctx.chains);
  });

  test("throws when a key is missing", () => {
    const ctx: ScenarioContext = {};
    try {
      requireContext(ctx, "chains");
      throw new Error("Expected requireContext to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StatecraftError);
      const structured = error as StatecraftError;
      expect(structured.code).toBe("SC_CONTEXT_MISSING");
      expect(structured.context.key).toBe("chains");
      expect(structured.suggestedAction).toMatch(/compose a fixture/i);
    }
  });
});
