import { beforeEach, describe, expect, test, vi } from "vitest";
import { withDeployments } from "./withDeployments.js";

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

describe("withDeployments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws when artifact ABI is missing", async () => {
    const step = withDeployments({
      token: {
        artifact: { bytecode: "0x60016000f3" },
      },
    });

    await expect(
      step(
        {
          runtime: { rpcUrl: "http://127.0.0.1:8545" },
          publicClient: {},
          walletClient: { account: {} },
          testClient: {},
        } as any,
        async () => {
          throw new Error("next should not run");
        },
      ),
    ).rejects.toThrow(/token\.artifact\.abi is required/i);
  });

  test("throws when wallet account is missing", async () => {
    const step = withDeployments({
      token: {
        artifact: { abi: [], bytecode: "0x60016000f3" },
      },
    });

    await expect(
      step(
        {
          runtime: { rpcUrl: "http://127.0.0.1:8545" },
          publicClient: {},
          walletClient: {},
          testClient: {},
        } as any,
        async () => {
          throw new Error("next should not run");
        },
      ),
    ).rejects.toThrow(/requires a walletClient account/i);
  });

  test("deploys in order, resolves args from prior deployments, and merges context", async () => {
    const account = { address: "0x000000000000000000000000000000000000000f" };
    const deployContract = vi
      .fn(async () => "0xaaa")
      .mockResolvedValueOnce("0xaaa")
      .mockResolvedValueOnce("0xbbb");
    const waitForTransactionReceipt = vi
      .fn(async () => ({ contractAddress: "0x00000000000000000000000000000000000000aa" }))
      .mockResolvedValueOnce({
        contractAddress: "0x00000000000000000000000000000000000000aa",
      })
      .mockResolvedValueOnce({
        contractAddress: "0x00000000000000000000000000000000000000bb",
      });
    const afterDeploy = vi.fn(async () => undefined);

    getContract.mockImplementation(({ address }) => ({ address, kind: "contract" }));

    const step = withDeployments({
      first: {
        artifact: { abi: [], bytecode: "0x60016000f3" },
        args: [123n],
      },
      second: {
        artifact: { abi: [], bytecode: { object: "0x60026000f3" } },
        args: ({ deployments }) => [deployments.first!.address],
        afterDeploy,
      },
    });

    const next = vi.fn(async (nextCtx: any) => {
      expect(nextCtx.deployments.existing).toEqual({ address: "0x0000000000000000000000000000000000000001" });
      expect(nextCtx.deployments.first.address).toBe("0x00000000000000000000000000000000000000aa");
      expect(nextCtx.deployments.second.address).toBe("0x00000000000000000000000000000000000000bb");
    });

    await step(
      {
        runtime: { rpcUrl: "http://127.0.0.1:8545" },
        publicClient: { waitForTransactionReceipt },
        walletClient: { account, deployContract },
        testClient: {},
        wallet: account.address,
        deployments: { existing: { address: "0x0000000000000000000000000000000000000001" } },
      } as any,
      next,
    );

    expect(deployContract).toHaveBeenNthCalledWith(1, {
      abi: [],
      bytecode: "0x60016000f3",
      args: [123n],
      account,
    });
    expect(deployContract).toHaveBeenNthCalledWith(2, {
      abi: [],
      bytecode: "0x60026000f3",
      args: ["0x00000000000000000000000000000000000000aa"],
      account,
    });
    expect(afterDeploy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "second",
        wallet: account.address,
      }),
    );
    expect(getContract).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
