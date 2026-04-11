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
      deployments: {
        token: {
          artifact: { bytecode: "0x60016000f3" },
        },
      },
    });

    await expect(
      step(
        {
          chains: {
            default: {
              runtime: { rpcUrl: "http://127.0.0.1:8545" },
              publicClient: {},
              walletClient: { account: {} },
              testClient: {},
            },
          },
        } as any,
        async () => {
          throw new Error("next should not run");
        },
      ),
    ).rejects.toThrow(/token\.artifact\.abi is required/i);
  });

  test("throws when wallet account is missing", async () => {
    const step = withDeployments({
      deployments: {
        token: {
          artifact: { abi: [], bytecode: "0x60016000f3" },
        },
      },
    });

    await expect(
      step(
        {
          chains: {
            default: {
              runtime: { rpcUrl: "http://127.0.0.1:8545" },
              publicClient: {},
              walletClient: {},
              testClient: {},
            },
          },
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
      deployments: {
        first: {
          artifact: { abi: [], bytecode: "0x60016000f3" },
          args: [123n],
        },
        second: {
          artifact: { abi: [], bytecode: { object: "0x60026000f3" } },
          args: ({ deployments }) => [deployments.first!.address],
          afterDeploy,
        },
      },
    });

    const next = vi.fn(async (nextCtx: any) => {
      const dep = nextCtx.chains.default.deployments!;
      expect(dep.existing).toEqual({ address: "0x0000000000000000000000000000000000000001" });
      expect(dep.first.address).toBe("0x00000000000000000000000000000000000000aa");
      expect(dep.second.address).toBe("0x00000000000000000000000000000000000000bb");
    });

    await step(
      {
        chains: {
          default: {
            runtime: { rpcUrl: "http://127.0.0.1:8545" },
            publicClient: { waitForTransactionReceipt },
            walletClient: { account, deployContract },
            testClient: {},
            wallet: account.address,
            deployments: { existing: { address: "0x0000000000000000000000000000000000000001" } },
          },
        },
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
        chain: "default",
        wallet: account.address,
      }),
    );
    expect(getContract).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("supports legacy config shape without `deployments` wrapper", async () => {
    const account = { address: "0x000000000000000000000000000000000000000f" };
    const deployContract = vi.fn(async () => "0xaaa");
    const waitForTransactionReceipt = vi.fn(async () => ({
      contractAddress: "0x00000000000000000000000000000000000000aa",
    }));

    const step = withDeployments({
      token: {
        artifact: { abi: [], bytecode: "0x60016000f3" },
      },
    });

    await step(
      {
        chains: {
          default: {
            runtime: { rpcUrl: "http://127.0.0.1:8545" },
            publicClient: { waitForTransactionReceipt },
            walletClient: { account, deployContract },
            testClient: {},
          },
        },
      } as any,
      async () => undefined,
    );

    expect(deployContract).toHaveBeenCalledTimes(1);
    expect(waitForTransactionReceipt).toHaveBeenCalledTimes(1);
  });

  test("supports strict preflight mode with machine-readable callback", async () => {
    const onPreflight = vi.fn();
    const step = withDeployments({
      preflightMode: "strict",
      onPreflight,
      deployments: {
        token: {
          artifact: { abi: [], bytecode: "0x60016000f3" },
        },
      },
    });

    await expect(
      step(
        {
          chains: {
            default: {
              chain: { id: 31337 },
              runtime: { rpcUrl: "http://127.0.0.1:8545" },
              publicClient: {},
              walletClient: { account: { address: "0x0000000000000000000000000000000000000001" } },
              testClient: {},
            },
          },
        } as any,
        async () => undefined,
      ),
    ).rejects.toThrow(/preflight failed/i);

    expect(onPreflight).toHaveBeenCalledTimes(1);
    expect(onPreflight.mock.calls[0]?.[0]?.result).toMatchObject({
      canExecute: false,
    });
  });
});
