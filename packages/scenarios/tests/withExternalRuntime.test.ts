import { describe, expect, test, vi } from "vitest";
import { withExternalRuntime } from "../src/fixtures/withExternalRuntime";

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
    expect(ctx.runtime.key).toBe("suite");
    expect(ctx.publicClient).toBeDefined();
    expect(ctx.walletClient).toBeDefined();
    expect(ctx.testClient).toBeDefined();
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
