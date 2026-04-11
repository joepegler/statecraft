import { describe, expect, test, vi } from "vitest";
import type { Address } from "viem";

const ENTRYPOINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as Address;

const startBundler = vi.fn();
const createBundlerClient = vi.fn();

vi.mock("../internal/startBundler.js", () => ({ startBundler }));
vi.mock("../../clients/index.js", () => ({ createBundlerClient }));

function forkCtx(overrides: Record<string, unknown> = {}) {
  return {
    chains: {
      default: {
        runtime: { rpcUrl: "http://127.0.0.1:8545" },
        runtimeMode: "fork",
        publicClient: { chain: {} },
        walletClient: {},
        testClient: { setBalance: vi.fn(async () => {}), ...overrides },
      },
    },
  } as any;
}

describe("withBundler", () => {
  test("throws when runtime clients are missing", async () => {
    const { withBundler } = await import("./withBundler.js");

    const step = withBundler({ entryPoint: ENTRYPOINT });

    await expect(
      step(
        {} as any,
        async () => {
          throw new Error("next should not run");
        },
      ),
    ).rejects.toThrow(/missing runtime clients for chain "default"/i);
  });

  test("starts bundler, injects bundler fields, and stops on success", async () => {
    const stop = vi.fn(async () => {});
    startBundler.mockResolvedValue({
      bundlerUrl: "http://127.0.0.1:9999",
      stop,
    });
    createBundlerClient.mockReturnValue({
      getSupportedEntryPoints: vi.fn(async () => [ENTRYPOINT]),
      estimateUserOperationGas: vi.fn(async () => ({})),
      sendUserOperation: vi.fn(async () => "0xabc" as const),
      getUserOperationReceipt: vi.fn(async () => null),
    });

    const { withBundler } = await import("./withBundler.js");

    const ctx = forkCtx();
    ctx.chains.default.chain = {};

    const next = vi.fn(async (nextCtx: any) => {
      expect(nextCtx.chains.default.bundlerUrl).toBe("http://127.0.0.1:9999");
      expect(nextCtx.chains.default.entryPoint).toBe(ENTRYPOINT);
      expect(nextCtx.chains.default.bundlerClient).toBeDefined();
    });

    const step = withBundler({ entryPoint: ENTRYPOINT });
    await step(ctx, next);

    expect(startBundler).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test("stops bundler when next throws", async () => {
    const stop = vi.fn(async () => {});
    startBundler.mockResolvedValue({
      bundlerUrl: "http://127.0.0.1:9999",
      stop,
    });
    createBundlerClient.mockReturnValue({
      getSupportedEntryPoints: vi.fn(async () => [ENTRYPOINT]),
      estimateUserOperationGas: vi.fn(async () => ({})),
      sendUserOperation: vi.fn(async () => "0xabc" as const),
      getUserOperationReceipt: vi.fn(async () => null),
    });

    const { withBundler } = await import("./withBundler.js");

    const ctx = forkCtx();
    ctx.chains.default.chain = {};

    const step = withBundler({ entryPoint: ENTRYPOINT });
    await expect(
      step(ctx, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(stop).toHaveBeenCalledTimes(1);
  });

  test("rejects unknown bundler mode", async () => {
    const { withBundler } = await import("./withBundler.js");

    const step = withBundler({ entryPoint: ENTRYPOINT, mode: "alto" as any });
    expect(step).toBeDefined();

    const badStep = withBundler({ entryPoint: ENTRYPOINT, mode: "nope" as any });
    const ctx = forkCtx();
    ctx.chains.default.chain = {};
    await expect(
      badStep(
        ctx,
        async () => {},
      ),
    ).rejects.toThrow(/only supports mode='alto'/i);
  });

  test("requires fork runtime mode", async () => {
    const { withBundler } = await import("./withBundler.js");
    const step = withBundler({ entryPoint: ENTRYPOINT });

    const ctx = {
      chains: {
        default: {
          runtime: { rpcUrl: "http://127.0.0.1:8545" },
          runtimeMode: "chain",
          chain: {},
          publicClient: { chain: {} },
          walletClient: {},
          testClient: { setBalance: vi.fn(async () => {}) },
        },
      },
    } as any;

    await expect(
      step(ctx, async () => {}),
    ).rejects.toThrow(/requires withFork\(\.\.\.\)/i);
  });
});
