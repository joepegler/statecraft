import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";
import { parseEther } from "viem";
import {
  scenario,
  withChain,
  withContracts,
  withDeployments,
  withFork,
  withFundedWallet,
} from "@statecraft/vitest";
import type { ContractArtifact, ScenarioContext } from "@statecraft/vitest";
import answerArtifact from "../artifacts/Answer.json";
import { erc20Abi } from "viem";

const hasAnvil =
  spawnSync("anvil", ["--version"], { stdio: "ignore" }).status === 0;
const hasMainnetRpc = Boolean(process.env.MAINNET_RPC_URL);

test.runIf(hasAnvil)(
  "fresh chain + funded wallet",
  scenario(
    withChain(),
    withFundedWallet({
      balance: parseEther("1"),
    }),
    async ({ wallet, publicClient }: ScenarioContext) => {
      const balance = await publicClient!.getBalance({ address: wallet! });
      expect(balance).toBe(parseEther("1"));
    },
  ),
);

test.runIf(hasAnvil && hasMainnetRpc)(
  "forked chain + funded wallet + real contract call",
  scenario(
    withFork({
      rpcUrl: process.env.MAINNET_RPC_URL!,
      blockNumber: 22_000_000n,
    }),
    withFundedWallet({
      balance: parseEther("1"),
    }),
    async ({ wallet, publicClient }: ScenarioContext) => {
      const wethAddress = "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2";
      const tokenBalance = await publicClient!.readContract({
        address: wethAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet!],
      });

      expect(tokenBalance).toBe(0n);
    },
  ),
);

test.runIf(hasAnvil)(
  "deployment example",
  scenario(
    withChain(),
    withDeployments({
      answer: {
        artifact: answerArtifact as ContractArtifact,
        args: [],
      },
    }),
    async ({ deployments }: ScenarioContext) => {
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

test.runIf(hasAnvil)(
  "contract injection example",
  scenario(
    withChain(),
    withContracts({
      answer: {
        artifact: answerArtifact as ContractArtifact,
        address: "0x1000000000000000000000000000000000000001",
      },
    }),
    async ({ contracts }: ScenarioContext) => {
      const contract = contracts?.answer;
      if (!contract) {
        throw new Error("Expected contract handle for answer.");
      }
      const value = await (contract as any).read.answer();
      expect(value).toBe(42n);
    },
  ),
);
