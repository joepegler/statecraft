import { describe, expect, test, vi } from "vitest";
import { withExternalRuntime } from "./withExternalRuntime.js";

describe("withExternalRuntime", () => {
  test("attaches caller-owned runtime clients and forwards context", async () => {
    const step = withExternalRuntime({
      runtime: {
        key: "suite",
        rpcUrl: "http://127.0.0.1:8545",
        async stop() {
          // noop
        },
      },
    });

    const next = vi.fn(async (_ctx) => {});
    await step({}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const [ctx] = next.mock.calls[0]!;
    const ch = ctx.chains!.default;
    expect(ch.runtime.key).toBe("suite");
    expect(ch.runtimeMode).toBe("chain");
    expect(ch.chain).toBeDefined();
    expect(ch.publicClient).toBeDefined();
    expect(ch.walletClient).toBeDefined();
    expect(ch.testClient).toBeDefined();
    expect(ctx.publicClient).toBe(ch.publicClient);
    expect(ctx.altPublicClient).toBeUndefined();
  });

  test("does not stop runtime lifecycle", async () => {
    const stop = vi.fn(async () => {});
    const step = withExternalRuntime({
      runtime: {
        key: "suite",
        rpcUrl: "http://127.0.0.1:8545",
        stop,
      },
    });

    await step({}, async () => {});
    expect(stop).not.toHaveBeenCalled();
  });
});
