import { afterAll, beforeAll, describe, expect, test } from "vitest";
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
  withFork,
  withFundedWallet,
  withSnapshot,
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
      async ({ wallet, publicClient }) => {
        const balance = await publicClient.getBalance({ address: wallet });
        expect(balance).toBe(parseEther("2"));
      },
    )();
  });

  test("snapshot isolates chain mutations across tests", async () => {
    await scenario(
      withExternalRuntime({ runtime, clients: { chainId: 31_337 } }),
      withSnapshot(),
      withFundedWallet({ balance: parseEther("1") }),
      async ({ wallet, publicClient, testClient }) => {
        const original = await publicClient.getBalance({ address: wallet });
        await testClient.setBalance({
          address: wallet,
          value: parseEther("9"),
        });
        const changed = await publicClient.getBalance({ address: wallet });
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
    async ({ entryPoint, bundlerUrl, bundlerClient }) => {
      expect(entryPoint).toBe(entryPoint4337);
      expect(bundlerUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const supported = await bundlerClient.getSupportedEntryPoints();
      const normalized = supported.map((a) => getAddress(a));
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
    async ({ wallet, publicClient }) => {
      const balance = await publicClient.getBalance({ address: wallet });
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
    async ({ wallet, publicClient }) => {
      const tokenBalance = await publicClient.readContract({
        address: wethAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
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
    async ({ wallet, publicClient }) => {
      const tokenBalance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
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
    async ({ wallet, publicClient }) => {
      const tokenBalance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
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
      answer: {
        artifact: answerArtifact as ContractArtifact,
        args: [],
      },
    }),
    async ({ deployments }) => {
      const deployment = deployments?.answer;
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
      answer: {
        artifact: answerArtifact as ContractArtifact,
        address: "0x1000000000000000000000000000000000000001",
      },
    }),
    async ({ contracts }) => {
      const contract = contracts?.answer;
      if (!contract) {
        throw new Error("Expected contract handle for answer.");
      }
      const value = await (contract as any).read.answer();
      expect(value).toBe(42n);
    },
  ),
);
