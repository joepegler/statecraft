import { beforeEach, describe, expect, test, vi } from "vitest";

const startRuntime = vi.fn();
const stopRuntime = vi.fn();
const createClients = vi.fn();

vi.mock("../../runtime/index.js", () => ({
  startRuntime,
  stopRuntime,
}));

vi.mock("../../clients/index.js", () => ({
  createClients,
}));

describe("withMultiChain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws when config is empty", async () => {
    const { withMultiChain } = await import("./withMultiChain.js");
    const step = withMultiChain({});

    await expect(
      step({} as any, async () => {
        throw new Error("next should not run");
      }),
    ).rejects.toThrow(/at least one chain entry/i);
  });

  test("starts two chain runtimes, forwards ctx.chains, and stops both in reverse order", async () => {
    const runtimeA = { rpcUrl: "http://127.0.0.1:8545" };
    const runtimeB = { rpcUrl: "http://127.0.0.1:8546" };
    const clientsA = {
      publicClient: { chain: { id: 31337 } },
      walletClient: { a: true },
      testClient: { a: true },
    };
    const clientsB = {
      publicClient: { chain: { id: 31338 } },
      walletClient: { b: true },
      testClient: { b: true },
    };

    startRuntime.mockResolvedValueOnce(runtimeA).mockResolvedValueOnce(runtimeB);
    createClients.mockReturnValueOnce(clientsA).mockReturnValueOnce(clientsB);

    const { withMultiChain } = await import("./withMultiChain.js");
    const step = withMultiChain({
      a: { type: "chain", chainId: 31337 },
      b: { type: "chain", chainId: 31338 },
    });

    const next = vi.fn(async (nextCtx: any) => {
      expect(nextCtx.chains.a.runtime).toBe(runtimeA);
      expect(nextCtx.chains.a.runtimeMode).toBe("chain");
      expect(nextCtx.chains.b.runtime).toBe(runtimeB);
      expect(nextCtx.chains.b.runtimeMode).toBe("chain");
    });

    await step({} as any, next);

    expect(startRuntime).toHaveBeenCalledTimes(2);
    expect(stopRuntime).toHaveBeenCalledTimes(2);
    expect(stopRuntime).toHaveBeenNthCalledWith(1, runtimeB);
    expect(stopRuntime).toHaveBeenNthCalledWith(2, runtimeA);
  });

  test("throws on duplicate keys", async () => {
    const { withMultiChain } = await import("./withMultiChain.js");
    const step = withMultiChain({
      a: { type: "chain" },
    });

    await expect(
      step(
        {
          chains: {
            a: {
              runtime: { rpcUrl: "x" },
              runtimeMode: "chain" as const,
              chain: {},
              publicClient: {},
              walletClient: {},
              testClient: {},
            },
          },
        } as any,
        async () => {},
      ),
    ).rejects.toThrow(/duplicate chain key "a"/i);
  });
});
