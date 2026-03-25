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

describe("withChain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("starts runtime, forwards clients, and stops on success", async () => {
    const runtime = { rpcUrl: "http://127.0.0.1:8545" };
    const clients = {
      publicClient: { chain: { id: 31337 } },
      walletClient: {},
      testClient: {},
    };
    startRuntime.mockResolvedValue(runtime);
    createClients.mockReturnValue(clients);

    const { withChain } = await import("./withChain");
    const step = withChain({ chainId: 31337, key: "suite" });

    const next = vi.fn(async (nextCtx: any) => {
      expect(nextCtx.runtime).toBe(runtime);
      expect(nextCtx.publicClient).toBe(clients.publicClient);
      expect(nextCtx.walletClient).toBe(clients.walletClient);
      expect(nextCtx.testClient).toBe(clients.testClient);
      expect(nextCtx.keep).toBe("me");
    });

    await step({ keep: "me" } as any, next);

    expect(startRuntime).toHaveBeenCalledWith({
      mode: "chain",
      chainId: 31337,
      key: "suite",
    });
    expect(createClients).toHaveBeenCalledWith(runtime, { chainId: 31337 });
    expect(stopRuntime).toHaveBeenCalledWith(runtime);
  });

  test("stops runtime when next throws", async () => {
    const runtime = { rpcUrl: "http://127.0.0.1:8545" };
    startRuntime.mockResolvedValue(runtime);
    createClients.mockReturnValue({
      publicClient: {},
      walletClient: {},
      testClient: {},
    });

    const { withChain } = await import("./withChain");
    const step = withChain();

    await expect(
      step({} as any, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(startRuntime).toHaveBeenCalledWith({ mode: "chain" });
    expect(createClients).toHaveBeenCalledWith(runtime, {});
    expect(stopRuntime).toHaveBeenCalledWith(runtime);
  });
});
