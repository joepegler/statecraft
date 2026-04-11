import { describe, expect, test } from "vitest";
import { describeScenarioConstraints, resolvePublicClientAliases } from "./utils.js";

describe("scenario constraints", () => {
  test("exposes explicit machine-readable constraints", () => {
    const constraints = describeScenarioConstraints();
    expect(constraints.maxChains).toBe(2);
    expect(constraints.supportedBundlerModes).toContain("alto");
    expect(constraints.publicClientAliasPolicies).toContain("lexical");
  });

  test("supports explicit lexical alias policy", () => {
    const chains = {
      zeta: { publicClient: { id: "zeta" } },
      alpha: { publicClient: { id: "alpha" } },
    } as any;
    const aliases = resolvePublicClientAliases(chains, "lexical");
    expect(aliases.publicClient).toBe(chains.alpha.publicClient);
    expect(aliases.altPublicClient).toBe(chains.zeta.publicClient);
  });
});
