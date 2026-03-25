import { describe, expect, test, vi } from "vitest";
import type { Hex } from "viem";
import { withContracts } from "./withContracts.js";

const { getContract } = vi.hoisted(() => ({
  getContract: vi.fn(),
}));

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    getContract,
  };
});

describe("withContracts", () => {
  test("throws when runtime clients are missing", async () => {
    const step = withContracts({
      token: {
        address: "0x00000000000000000000000000000000000000aa",
        artifact: { deployedBytecode: "0x60016000f3" },
      },
    });

    await expect(
      step({} as any, async () => {
        throw new Error("next should not run");
      }),
    ).rejects.toThrow(/missing runtime clients/i);
  });

  test("sets code, calls afterSetCode, and merges named contracts", async () => {
    const setCode = vi.fn(async () => undefined);
    const afterSetCode = vi.fn(async () => undefined);
    getContract.mockImplementation(({ address }) => ({ address, kind: "contract" }));

    const ctx = {
      runtime: { rpcUrl: "http://127.0.0.1:8545" },
      publicClient: {},
      walletClient: {},
      testClient: { setCode },
      contracts: { existing: { address: "0x0000000000000000000000000000000000000001" } },
    } as any;

    const step = withContracts({
      token: {
        address: "0x00000000000000000000000000000000000000aa",
        artifact: {
          abi: [],
          deployedBytecode: { object: "0x60016000f3" as Hex },
        },
        afterSetCode,
      },
      proxy: {
        address: "0x00000000000000000000000000000000000000bb",
        artifact: {
          deployedBytecode: "0x60026000f3",
        },
      },
    });

    const next = vi.fn(async (nextCtx: any) => {
      expect(nextCtx.contracts.existing).toEqual(ctx.contracts.existing);
      expect(nextCtx.contracts.token).toEqual({
        address: "0x00000000000000000000000000000000000000aa",
        kind: "contract",
      });
      expect(nextCtx.contracts.proxy).toEqual({
        address: "0x00000000000000000000000000000000000000bb",
      });
    });

    await step(ctx, next);

    expect(setCode).toHaveBeenNthCalledWith(1, {
      address: "0x00000000000000000000000000000000000000aa",
      bytecode: "0x60016000f3",
    });
    expect(setCode).toHaveBeenNthCalledWith(2, {
      address: "0x00000000000000000000000000000000000000bb",
      bytecode: "0x60026000f3",
    });
    expect(afterSetCode).toHaveBeenCalledWith({
      name: "token",
      address: "0x00000000000000000000000000000000000000aa",
      testClient: ctx.testClient,
      publicClient: ctx.publicClient,
      walletClient: ctx.walletClient,
    });
    expect(getContract).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
