import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ScenarioFundedWalletContext } from "../types.js";
import { withImpersonation } from "./withImpersonation.js";

const { createWalletClient, http } = vi.hoisted(() => ({
  createWalletClient: vi.fn(),
  http: vi.fn(),
}));

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createWalletClient,
    http,
  };
});

describe("withImpersonation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws when runtime clients are missing", async () => {
    const step = withImpersonation({
      address: "0x00000000000000000000000000000000000000aa",
    });

    await expect(
      step({} as any, async () => {
        throw new Error("next should not run");
      }),
    ).rejects.toThrow(/missing runtime clients for chain "default"/i);
  });

  test("impersonates address, optionally sets balance, forwards context, and stops on success", async () => {
    const address = "0x00000000000000000000000000000000000000ab";
    const impersonateAccount = vi.fn(async () => undefined);
    const stopImpersonatingAccount = vi.fn(async () => undefined);
    const setBalance = vi.fn(async () => undefined);
    const walletClient = { kind: "impersonated-wallet-client" };
    const next = vi.fn(async (_ctx: ScenarioFundedWalletContext) => undefined);

    http.mockReturnValue({ kind: "http-transport" });
    createWalletClient.mockReturnValue(walletClient);

    const step = withImpersonation({
      address,
      balance: 2n,
    });

    await step(
      {
        chains: {
          default: {
            runtime: { rpcUrl: "http://127.0.0.1:8545" },
            publicClient: { chain: { id: 31337 } },
            walletClient: {},
            testClient: {
              impersonateAccount,
              stopImpersonatingAccount,
              setBalance,
            },
          },
        },
      } as any,
      next,
    );

    expect(impersonateAccount).toHaveBeenCalledWith({ address });
    expect(setBalance).toHaveBeenCalledWith({ address, value: 2n });
    expect(http).toHaveBeenCalledWith("http://127.0.0.1:8545");
    expect(createWalletClient).toHaveBeenCalledWith({
      account: address,
      chain: { id: 31337 },
      transport: { kind: "http-transport" },
    });

    const [forwarded] = next.mock.calls[0]!;
    expect(forwarded.chains!.default.wallet).toBe(address);
    expect(forwarded.chains!.default.walletClient).toBe(walletClient);
    expect(stopImpersonatingAccount).toHaveBeenCalledWith({ address });
  });

  test("stops impersonation when downstream step throws", async () => {
    const address = "0x00000000000000000000000000000000000000ac";
    const impersonateAccount = vi.fn(async () => undefined);
    const stopImpersonatingAccount = vi.fn(async () => undefined);

    http.mockReturnValue({ kind: "http-transport" });
    createWalletClient.mockReturnValue({ kind: "impersonated-wallet-client" });

    const step = withImpersonation({ address });

    await expect(
      step(
        {
          chains: {
            default: {
              runtime: { rpcUrl: "http://127.0.0.1:8545" },
              publicClient: { chain: { id: 31337 } },
              walletClient: {},
              testClient: {
                impersonateAccount,
                stopImpersonatingAccount,
                setBalance: vi.fn(),
              },
            },
          },
        } as any,
        async () => {
          throw new Error("boom");
        },
      ),
    ).rejects.toThrow("boom");

    expect(impersonateAccount).toHaveBeenCalledWith({ address });
    expect(stopImpersonatingAccount).toHaveBeenCalledWith({ address });
  });

  test("does not stop impersonation when stopOnExit is false", async () => {
    const address = "0x00000000000000000000000000000000000000ad";
    const impersonateAccount = vi.fn(async () => undefined);
    const stopImpersonatingAccount = vi.fn(async () => undefined);

    http.mockReturnValue({ kind: "http-transport" });
    createWalletClient.mockReturnValue({ kind: "impersonated-wallet-client" });

    const step = withImpersonation({
      address,
      stopOnExit: false,
    });

    await step(
      {
        chains: {
          default: {
            runtime: { rpcUrl: "http://127.0.0.1:8545" },
            publicClient: { chain: { id: 31337 } },
            walletClient: {},
            testClient: {
              impersonateAccount,
              stopImpersonatingAccount,
              setBalance: vi.fn(),
            },
          },
        },
      } as any,
      async () => {},
    );

    expect(impersonateAccount).toHaveBeenCalledWith({ address });
    expect(stopImpersonatingAccount).not.toHaveBeenCalled();
  });
});
