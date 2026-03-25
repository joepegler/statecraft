import { describe, expect, test, vi } from "vitest";
import { withSnapshot } from "./withSnapshot.js";

describe("withSnapshot", () => {
  test("throws when runtime clients are missing", async () => {
    const step = withSnapshot();

    await expect(
      step({} as any, async () => {
        throw new Error("next should not run");
      }),
    ).rejects.toThrow(/missing runtime clients/i);
  });

  test("creates snapshot, runs next, and reverts on success", async () => {
    const snapshot = vi.fn(async () => "0x01");
    const revert = vi.fn(async () => undefined);
    const next = vi.fn(async () => undefined);

    const step = withSnapshot();
    await step(
      {
        runtime: { rpcUrl: "http://127.0.0.1:8545" },
        publicClient: {},
        walletClient: {},
        testClient: { snapshot, revert },
      } as any,
      next,
    );

    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(revert).toHaveBeenCalledWith({ id: "0x01" });
  });

  test("reverts snapshot when next throws", async () => {
    const snapshot = vi.fn(async () => "0x02");
    const revert = vi.fn(async () => undefined);

    const step = withSnapshot();
    await expect(
      step(
        {
          runtime: { rpcUrl: "http://127.0.0.1:8545" },
          publicClient: {},
          walletClient: {},
          testClient: { snapshot, revert },
        } as any,
        async () => {
          throw new Error("boom");
        },
      ),
    ).rejects.toThrow("boom");

    expect(revert).toHaveBeenCalledWith({ id: "0x02" });
  });
});
