import { beforeEach, describe, expect, test, vi } from "vitest";
import { withBridge } from "./withBridge.js";
import { NATIVE_TOKEN_ADDRESS } from "../types.js";

const { dealErc20Balance } = vi.hoisted(() => ({
  dealErc20Balance: vi.fn(),
}));

vi.mock("../internal/dealErc20Balance.js", () => ({
  dealErc20Balance,
}));

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0ce3606eB48" as const;
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const;
const ALICE = "0x00000000000000000000000000000000000000a1" as const;
const BOB = "0x00000000000000000000000000000000000000b2" as const;

describe("withBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("exposes ctx.bridge and does not execute until called by test", async () => {
    const srcBalances = new Map<string, bigint>([[ALICE, 10n]]);
    const destBalances = new Map<string, bigint>([[BOB, 1n]]);

    const step = withBridge({
      srcChain: "src",
      destChain: "dest",
      fromToken: NATIVE_TOKEN_ADDRESS,
      toToken: NATIVE_TOKEN_ADDRESS,
    });

    const ctx = {
      chains: {
        src: makeNativeChain({ wallet: ALICE, balances: srcBalances }),
        dest: makeNativeChain({ wallet: BOB, balances: destBalances }),
      },
    } as any;

    const next = vi.fn(async (nextCtx: any) => {
      expect(nextCtx.bridge).toBeDefined();
      expect(srcBalances.get(ALICE)).toBe(10n);
      expect(destBalances.get(BOB)).toBe(1n);
    });

    await step(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("debits native on src and credits native on dest", async () => {
    const srcBalances = new Map<string, bigint>([[ALICE, 10n]]);
    const destBalances = new Map<string, bigint>([[BOB, 1n]]);

    const step = withBridge({
      srcChain: "src",
      destChain: "dest",
      fromToken: NATIVE_TOKEN_ADDRESS,
      toToken: NATIVE_TOKEN_ADDRESS,
      priceScale: 10n,
    });

    const ctx = {
      chains: {
        src: makeNativeChain({ wallet: ALICE, balances: srcBalances }),
        dest: makeNativeChain({ wallet: BOB, balances: destBalances }),
      },
    } as any;

    await step(ctx, async (nextCtx: any) => {
      const receipt = await nextCtx.bridge.execute({ amountIn: 5n, price: 4n });
      expect(receipt.amountOut).toBe(2n);
    });

    expect(srcBalances.get(ALICE)).toBe(5n);
    expect(destBalances.get(BOB)).toBe(3n);
  });

  test("debits ERC-20 on src and credits ERC-20 on dest", async () => {
    const srcTokenBalances = new Map<string, bigint>([[`${USDC}:${ALICE}`.toLowerCase(), 1000n]]);
    const destTokenBalances = new Map<string, bigint>([[`${USDT}:${BOB}`.toLowerCase(), 50n]]);

    const step = withBridge({
      srcChain: "src",
      destChain: "dest",
      fromToken: USDC,
      toToken: USDT,
      from: ALICE,
      to: BOB,
      priceScale: 100n,
    });

    const ctx = {
      chains: {
        src: makeErc20Chain(srcTokenBalances),
        dest: makeErc20Chain(destTokenBalances),
      },
    } as any;

    await step(ctx, async (nextCtx: any) => {
      await nextCtx.bridge.execute({ amountIn: 500n, price: 20n });
    });

    expect(dealErc20Balance).toHaveBeenCalledTimes(2);
    expect(dealErc20Balance).toHaveBeenNthCalledWith(1, expect.objectContaining({ token: USDC, recipient: ALICE, amount: 500n }));
    expect(dealErc20Balance).toHaveBeenNthCalledWith(2, expect.objectContaining({ token: USDT, recipient: BOB, amount: 150n }));
  });

  test("supports per-call recipient overrides", async () => {
    const srcBalances = new Map<string, bigint>([
      [ALICE, 10n],
      [BOB, 20n],
    ]);
    const destBalances = new Map<string, bigint>([
      [ALICE, 1n],
      [BOB, 2n],
    ]);

    const step = withBridge({
      srcChain: "src",
      destChain: "dest",
      fromToken: NATIVE_TOKEN_ADDRESS,
      toToken: NATIVE_TOKEN_ADDRESS,
      from: ALICE,
      to: ALICE,
    });

    const ctx = {
      chains: {
        src: makeNativeChain({ wallet: ALICE, balances: srcBalances }),
        dest: makeNativeChain({ wallet: ALICE, balances: destBalances }),
      },
    } as any;

    await step(ctx, async (nextCtx: any) => {
      await nextCtx.bridge.execute({
        amountIn: 7n,
        price: 2n,
        from: BOB,
        to: BOB,
      });
    });

    expect(srcBalances.get(ALICE)).toBe(10n);
    expect(srcBalances.get(BOB)).toBe(13n);
    expect(destBalances.get(ALICE)).toBe(1n);
    expect(destBalances.get(BOB)).toBe(16n);
  });

  test("throws when required chains are missing", async () => {
    const step = withBridge({
      srcChain: "src",
      destChain: "dest",
      fromToken: NATIVE_TOKEN_ADDRESS,
      toToken: NATIVE_TOKEN_ADDRESS,
    });

    await expect(step({ chains: {} } as any, async () => {})).rejects.toThrow(/missing runtime clients for chain "src"/i);
  });
});

function makeNativeChain({
  wallet,
  balances,
}: {
  wallet?: `0x${string}`;
  balances: Map<string, bigint>;
}) {
  return {
    runtime: { rpcUrl: "http://127.0.0.1:8545" },
    runtimeMode: "chain" as const,
    chain: { id: 31337 },
    publicClient: {
      getBalance: vi.fn(async ({ address }: { address: `0x${string}` }) => balances.get(address) ?? 0n),
      readContract: vi.fn(),
    },
    walletClient: {},
    testClient: {
      mode: "anvil",
      setBalance: vi.fn(async ({ address, value }: { address: `0x${string}`; value: bigint }) => {
        balances.set(address, value);
      }),
    },
    wallet,
  };
}

function makeErc20Chain(tokenBalances: Map<string, bigint>) {
  return {
    runtime: { rpcUrl: "http://127.0.0.1:8545" },
    runtimeMode: "chain" as const,
    chain: { id: 31337 },
    publicClient: {
      getBalance: vi.fn(),
      readContract: vi.fn(async ({ address, args }: { address: `0x${string}`; args: readonly unknown[] }) => {
        const recipient = String(args[0]).toLowerCase();
        return tokenBalances.get(`${address}:${recipient}`.toLowerCase()) ?? 0n;
      }),
    },
    walletClient: {},
    testClient: {
      mode: "anvil",
      setBalance: vi.fn(),
    },
  };
}
