import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { getAddress, parseEther } from "viem";
import {
  scenario,
  startRuntime,
  stopRuntime,
  withBundler,
  withChain,
  withExternalRuntime,
  withContracts,
  withDeployments,
  withErc20Balance,
  withBridge,
  withFork,
  withFundedWallet,
  withMultiChain,
  withSnapshot,
  NATIVE_TOKEN_ADDRESS,
  type ContractArtifact,
  type RuntimeHandle,
} from "@st8craft/core";
import answerArtifact from "../artifacts/Answer.json";
import { erc20Abi } from "viem";

// Use viem's EIP-55 checksum normalization so we don't depend on manually-cased literals.
const wethAddress = getAddress("0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2");
const usdcAddress = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0ce3606eB48");
/** ERC-4337 EntryPoint deployed on Ethereum mainnet (matches `withBundler` tests and Alto defaults). */
const entryPoint4337 = getAddress("0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789");

describe("suite-scoped runtime (external lifecycle)", () => {
  let runtime: RuntimeHandle;

  beforeAll(async () => {
    runtime = await startRuntime({ mode: "chain", chainId: 31_337 });
  });

  afterAll(async () => {
    await stopRuntime(runtime);
  });

  test("supports repeated scenarios on one runtime", async () => {
    await scenario(
      withExternalRuntime({ runtime, clients: { chainId: 31_337 } }),
      withSnapshot(),
      withFundedWallet({ balance: parseEther("2") }),
      async ({ chains, publicClient }) => {
        const balance = await publicClient.getBalance({ address: chains!.default!.wallet! });
        expect(balance).toBe(parseEther("2"));
      },
    )();
  });

  test("snapshot isolates chain mutations across tests", async () => {
    await scenario(
      withExternalRuntime({ runtime, clients: { chainId: 31_337 } }),
      withSnapshot(),
      withFundedWallet({ balance: parseEther("1") }),
      async ({ chains, publicClient }) => {
        const original = await publicClient.getBalance({ address: chains!.default!.wallet! });
        await chains!.default!.testClient.setBalance({
          address: chains!.default!.wallet!,
          value: parseEther("9"),
        });
        const changed = await publicClient.getBalance({ address: chains!.default!.wallet! });
        expect(original).toBe(parseEther("1"));
        expect(changed).toBe(parseEther("9"));
      },
    )();
  });
});

test(
  "forked chain + withBundler exposes bundler RPC",
  scenario(
    withFork({
      rpcUrl: process.env.VITE_RPC_URL!,
      blockNumber: 22_000_000n,
    }),
    withBundler({ entryPoint: entryPoint4337, mode: "alto" }),
    async ({ chains }) => {
      expect(chains!.default!.entryPoint).toBe(entryPoint4337);
      expect(chains!.default!.bundlerUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const supported = await chains!.default!.bundlerClient!.getSupportedEntryPoints();
      const normalized = supported.map((a: `0x${string}`) => getAddress(a));
      expect(normalized).toContain(entryPoint4337);
    },
  ),
  10_000,
);

test(
  "fresh chain + funded wallet",
  scenario(
    withChain(),
    withFundedWallet({
      balance: parseEther("1"),
    }),
    async ({ chains, publicClient }) => {
      const balance = await publicClient.getBalance({ address: chains!.default!.wallet! });
      expect(balance).toBe(parseEther("1"));
    },
  ),
);

test(
  "forked chain + funded wallet + real contract call",
  scenario(
    withFork({
      rpcUrl: process.env.VITE_RPC_URL!,
      blockNumber: 22_000_000n,
    }),
    withFundedWallet({
      balance: parseEther("1"),
    }),
    async ({ chains, publicClient }) => {
      const tokenBalance = await publicClient.readContract({
        address: wethAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [chains!.default!.wallet!],
      });

      expect(tokenBalance).toBe(0n);
    },
  ),
);

test(
  "forked chain + funded wallet + USDC via withFundedWallet.erc20",
  scenario(
    withFork({
      rpcUrl: process.env.VITE_RPC_URL!,
      blockNumber: 22_000_000n,
    }),
    withFundedWallet({
      balance: parseEther("1"),
      erc20: [
        {
          token: usdcAddress,
          amount: 1_000_000n,
        },
      ],
    }),
    async ({ chains, publicClient }) => {
      const tokenBalance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [chains!.default!.wallet!],
      });
      expect(tokenBalance).toBe(1_000_000n);
    },
  ),
);

test(
  "forked chain + funded wallet + withErc20Balance step",
  scenario(
    withFork({
      rpcUrl: process.env.VITE_RPC_URL!,
      blockNumber: 22_000_000n,
    }),
    withFundedWallet({
      balance: parseEther("1"),
    }),
    withErc20Balance({
      token: usdcAddress,
      amount: 1_000_000n,
    }),
    async ({ chains, publicClient }) => {
      const tokenBalance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [chains!.default!.wallet!],
      });
      expect(tokenBalance).toBe(1_000_000n);
    },
  ),
);

test(
  "deployment example",
  scenario(
    withChain(),
    withDeployments({
      deployments: {
        answer: {
          artifact: answerArtifact as ContractArtifact,
          args: [],
        },
      },
    }),
    async ({ chains }) => {
      const deployment = chains!.default!.deployments?.answer;
      if (!deployment) {
        throw new Error("Expected deployment record for answer.");
      }
      const value = await (deployment.contract as any).read.answer();
      expect(value).toBe(42n);
      expect(deployment.address).toMatch(/^0x/i);
    },
  ),
);

test(
  "contract injection example",
  scenario(
    withChain(),
    withContracts({
      contracts: {
        answer: {
          artifact: answerArtifact as ContractArtifact,
          address: "0x1000000000000000000000000000000000000001",
        },
      },
    }),
    async ({ chains }) => {
      const contract = chains!.default!.contracts?.answer;
      if (!contract) {
        throw new Error("Expected contract handle for answer.");
      }
      const value = await (contract as any).read.answer();
      expect(value).toBe(42n);
    },
  ),
);

test(
  "withMultiChain: two local chains with independent funded wallets",
  scenario(
    withMultiChain({
      a: { type: "chain", chainId: 31_337 },
      b: { type: "chain", chainId: 31_338 },
    }),
    withFundedWallet({ chain: "a", balance: parseEther("1") }),
    withFundedWallet({ chain: "b", balance: parseEther("2") }),
    async ({ chains }) => {
      const a = chains!.a!;
      const b = chains!.b!;
      const ba = await a.publicClient.getBalance({ address: a.wallet! });
      const bb = await b.publicClient.getBalance({ address: b.wallet! });
      expect(ba).toBe(parseEther("1"));
      expect(bb).toBe(parseEther("2"));
    },
  ),
);

test(
  "withMultiChain: snapshot on one chain does not revert the other",
  scenario(
    withMultiChain({
      left: { type: "chain", chainId: 31_337 },
      right: { type: "chain", chainId: 31_338 },
    }),
    withFundedWallet({ chain: "left", balance: parseEther("1") }),
    withFundedWallet({ chain: "right", balance: parseEther("1") }),
    withSnapshot({ chain: "left" }),
    async ({ chains }) => {
      const left = chains!.left!;
      const right = chains!.right!;
      await left.testClient.setBalance({ address: left.wallet!, value: parseEther("9") });
      expect(await left.publicClient.getBalance({ address: left.wallet! })).toBe(parseEther("9"));
      expect(await right.publicClient.getBalance({ address: right.wallet! })).toBe(parseEther("1"));
    },
  ),
);

test(
  "withBridge: test controls bridge timing with Vitest helpers",
  scenario(
    withMultiChain({
      src: { type: "chain", chainId: 31_337 },
      dest: { type: "chain", chainId: 31_338 },
    }),
    withFundedWallet({ chain: "src", balance: parseEther("5") }),
    withFundedWallet({ chain: "dest", balance: parseEther("1") }),
    withBridge({
      srcChain: "src",
      destChain: "dest",
      fromToken: NATIVE_TOKEN_ADDRESS,
      toToken: NATIVE_TOKEN_ADDRESS,
      priceScale: 2n,
    }),
    async ({ chains, bridge }) => {
      const src = chains!.src!;
      const dest = chains!.dest!;
      const bridgeExecute = vi.fn(bridge!.execute);

      expect(await src.publicClient.getBalance({ address: src.wallet! })).toBe(parseEther("5"));
      expect(await dest.publicClient.getBalance({ address: dest.wallet! })).toBe(parseEther("1"));

      vi.useFakeTimers();
      let bridgeReceipt: Awaited<ReturnType<NonNullable<typeof bridge>["execute"]>> | undefined;
      let bridgeTask: Promise<void> | undefined;
      try {
        setTimeout(() => {
          bridgeTask = bridgeExecute({
              amountIn: parseEther("2"),
              price: 2n,
            })
            .then((receipt) => {
              bridgeReceipt = receipt;
            });
        }, 250);

        await vi.advanceTimersByTimeAsync(250);
        await vi.waitFor(() => {
          expect(bridgeTask).toBeDefined();
        });

        await bridgeTask!;
      } finally {
        vi.useRealTimers();
      }

      expect(bridgeReceipt?.amountOut).toBe(parseEther("2"));
      expect(bridgeExecute).toHaveBeenCalledTimes(1);
      expect(await src.publicClient.getBalance({ address: src.wallet! })).toBe(parseEther("3"));
      expect(await dest.publicClient.getBalance({ address: dest.wallet! })).toBe(parseEther("3"));
    },
  ),
);
