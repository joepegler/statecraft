import { describe, expect, test } from "vitest";
import { requireContext } from "../src/utils";
import type { ScenarioContext } from "../src/types";

describe("requireContext", () => {
  test("returns the same object when keys are present", () => {
    const ctx: ScenarioContext = {
      wallet: "0x0000000000000000000000000000000000000001",
    };
    const narrowed = requireContext(ctx, "wallet");
    expect(narrowed).toBe(ctx);
    expect(narrowed.wallet).toBe(ctx.wallet);
  });

  test("throws when a key is missing", () => {
    const ctx: ScenarioContext = {};
    expect(() => requireContext(ctx, "wallet")).toThrow(/missing required key:\s*wallet/i);
  });
});
