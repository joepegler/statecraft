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

describe("withFork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws when rpcUrl is missing", async () => {
    const { withFork } = await import("./withFork.js");
    const step = withFork({ rpcUrl: "", blockNumber: 1n });

    await expect(
      step({} as any, async () => {
        throw new Error("next should not run");
      }),
    ).rejects.toThrow(/requires rpcUrl/i);
  });

  test("throws when blockNumber is missing", async () => {
    const { withFork } = await import("./withFork.js");
    const step = withFork({
      rpcUrl: "https://eth-mainnet.example",
      blockNumber: undefined as unknown as bigint,
    });

    await expect(
      step({} as any, async () => {
        throw new Error("next should not run");
      }),
    ).rejects.toThrow(/pinned blockNumber/i);
  });

  test("starts fork runtime, forwards clients, and stops in finally", async () => {
    const runtime = { rpcUrl: "http://127.0.0.1:8545" };
    const clients = {
      publicClient: { chain: { id: 1 } },
      walletClient: {},
      testClient: {},
    };
    startRuntime.mockResolvedValue(runtime);
    createClients.mockReturnValue(clients);

    const { withFork } = await import("./withFork.js");
    const step = withFork({
      rpcUrl: "https://eth-mainnet.example",
      blockNumber: 20_000_000n,
      chainId: 1,
      key: "mainnet-fork",
    });

    const next = vi.fn(async (nextCtx: any) => {
      const ch = nextCtx.chains.default;
      expect(ch.runtime).toBe(runtime);
      expect(ch.runtimeMode).toBe("fork");
      expect(ch.chain).toBe(clients.publicClient.chain);
      expect(ch.publicClient).toBe(clients.publicClient);
      expect(ch.walletClient).toBe(clients.walletClient);
      expect(ch.testClient).toBe(clients.testClient);
      expect(nextCtx.publicClient).toBe(clients.publicClient);
      expect(nextCtx.altPublicClient).toBeUndefined();
    });
    await step({ seed: true } as any, next);

    expect(startRuntime).toHaveBeenCalledWith({
      mode: "fork",
      rpcUrl: "https://eth-mainnet.example",
      blockNumber: 20_000_000n,
      chainId: 1,
      key: "mainnet-fork",
    });
    expect(createClients).toHaveBeenCalledWith(runtime, { chainId: 1 });
    expect(stopRuntime).toHaveBeenCalledWith(runtime);
  });

  test("reuses identical runtime inputs across repeated runs", async () => {
    const runtime = { rpcUrl: "http://127.0.0.1:8545" };
    const clients = {
      publicClient: { chain: { id: 1 } },
      walletClient: {},
      testClient: {},
    };
    startRuntime.mockResolvedValue(runtime);
    createClients.mockReturnValue(clients);

    const { withFork } = await import("./withFork.js");
    const step = withFork({
      rpcUrl: "https://eth-mainnet.example",
      blockNumber: 20_000_000n,
      key: "deterministic-fork",
    });

    await step({} as any, async () => undefined);
    await step({} as any, async () => undefined);

    expect(startRuntime).toHaveBeenNthCalledWith(1, {
      mode: "fork",
      rpcUrl: "https://eth-mainnet.example",
      blockNumber: 20_000_000n,
      key: "deterministic-fork",
    });
    expect(startRuntime).toHaveBeenNthCalledWith(2, {
      mode: "fork",
      rpcUrl: "https://eth-mainnet.example",
      blockNumber: 20_000_000n,
      key: "deterministic-fork",
    });
  });
});
