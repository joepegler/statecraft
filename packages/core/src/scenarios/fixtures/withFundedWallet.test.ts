import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Hex } from "viem";
import type { ScenarioFundedWalletContext } from "../types.js";
import { withFundedWallet } from "./withFundedWallet.js";

const { createWalletClient, http, generatePrivateKey, privateKeyToAccount, dealErc20Balance } = vi.hoisted(() => ({
  createWalletClient: vi.fn(),
  http: vi.fn(),
  generatePrivateKey: vi.fn(),
  privateKeyToAccount: vi.fn(),
  dealErc20Balance: vi.fn(),
}));

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createWalletClient,
    http,
  };
});

vi.mock("viem/accounts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem/accounts")>();
  return {
    ...actual,
    generatePrivateKey,
    privateKeyToAccount,
  };
});

vi.mock("../internal/dealErc20Balance.js", () => ({
  dealErc20Balance,
}));

describe("withFundedWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws when runtime clients are missing", async () => {
    const step = withFundedWallet({ balance: 1n });
    await expect(
      step({} as any, async () => {
        throw new Error("next should not run");
      }),
    ).rejects.toThrow(/missing runtime clients for chain "default"/i);
  });

  test("uses provided private key, funds wallet, and forwards updated context", async () => {
    const privateKey = "0x1111111111111111111111111111111111111111111111111111111111111111" as Hex;
    const account = { address: "0x00000000000000000000000000000000000000aa" };
    const walletClient = { kind: "wallet-client" };
    const setBalance = vi.fn(async () => undefined);
    const next = vi.fn(async (_ctx: ScenarioFundedWalletContext) => undefined);

    privateKeyToAccount.mockReturnValue(account);
    http.mockReturnValue({ kind: "http-transport" });
    createWalletClient.mockReturnValue(walletClient);

    const step = withFundedWallet({ balance: 2n, privateKey });
    await step(
      {
        chains: {
          default: {
            runtime: { rpcUrl: "http://127.0.0.1:8545" },
            publicClient: { chain: { id: 31337 } },
            walletClient: { account: undefined },
            testClient: { setBalance },
          },
        },
      } as any,
      next,
    );

    expect(generatePrivateKey).not.toHaveBeenCalled();
    expect(privateKeyToAccount).toHaveBeenCalledWith(privateKey);
    expect(setBalance).toHaveBeenCalledWith({
      address: account.address,
      value: 2n,
    });
    expect(http).toHaveBeenCalledWith("http://127.0.0.1:8545");
    expect(createWalletClient).toHaveBeenCalledWith({
      account,
      chain: { id: 31337 },
      transport: { kind: "http-transport" },
    });

    const [forwarded] = next.mock.calls[0]!;
    expect(forwarded.chains!.default.wallet).toBe(account.address);
    expect(forwarded.chains!.default.walletClient).toBe(walletClient);
  });

  test("generates key when omitted and seeds configured ERC-20 balances", async () => {
    const generatedKey = "0x2222222222222222222222222222222222222222222222222222222222222222" as Hex;
    const account = { address: "0x00000000000000000000000000000000000000bb" };
    const setBalance = vi.fn(async () => undefined);

    generatePrivateKey.mockReturnValue(generatedKey);
    privateKeyToAccount.mockReturnValue(account);
    http.mockReturnValue({ kind: "http-transport" });
    createWalletClient.mockReturnValue({ kind: "wallet-client" });

    const step = withFundedWallet({
      balance: 3n,
      erc20: [
        { token: "0x00000000000000000000000000000000000000c1", amount: 10n },
        { token: "0x00000000000000000000000000000000000000c2", amount: 20n },
      ],
    });

    await step(
      {
        chains: {
          default: {
            runtime: { rpcUrl: "http://127.0.0.1:8545" },
            publicClient: { chain: { id: 31337 } },
            walletClient: {},
            testClient: { setBalance },
          },
        },
      } as any,
      async () => {},
    );

    expect(generatePrivateKey).toHaveBeenCalledTimes(1);
    expect(dealErc20Balance).toHaveBeenNthCalledWith(1, {
      testClient: { setBalance },
      token: "0x00000000000000000000000000000000000000c1",
      recipient: account.address,
      amount: 10n,
    });
    expect(dealErc20Balance).toHaveBeenNthCalledWith(2, {
      testClient: { setBalance },
      token: "0x00000000000000000000000000000000000000c2",
      recipient: account.address,
      amount: 20n,
    });
  });
});
