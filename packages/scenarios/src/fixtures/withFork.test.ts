import { beforeEach, describe, expect, test, vi } from "vitest";

const startRuntime = vi.fn();
const stopRuntime = vi.fn();
const createClients = vi.fn();

vi.mock("@st8craft/runtime", () => ({
  startRuntime,
  stopRuntime,
}));

vi.mock("@st8craft/clients", () => ({
  createClients,
}));

describe("withFork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws when rpcUrl is missing", async () => {
    const { withFork } = await import("./withFork");
    const step = withFork({ rpcUrl: "", blockNumber: 1n });

    await expect(
      step({} as any, async () => {
        throw new Error("next should not run");
      }),
    ).rejects.toThrow(/requires rpcUrl/i);
  });

  test("throws when blockNumber is missing", async () => {
    const { withFork } = await import("./withFork");
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

    const { withFork } = await import("./withFork");
    const step = withFork({
      rpcUrl: "https://eth-mainnet.example",
      blockNumber: 20_000_000n,
      chainId: 1,
      key: "mainnet-fork",
    });

    await expect(
      step({ seed: true } as any, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

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
});
