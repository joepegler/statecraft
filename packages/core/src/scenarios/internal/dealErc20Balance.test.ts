import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  type Address,
  type Chain,
  type Hex,
  type TestClient,
  type Transport,
  erc20Abi,
} from "viem";
import { readContract } from "viem/actions";
import { createClients } from "../../clients/index.js";
import type { RuntimeHandle } from "../../runtime/index.js";
import { startRuntime, stopRuntime } from "../../runtime/index.js";
import { dealErc20Balance } from "./dealErc20Balance.js";

type AnvilTestClient = TestClient<"anvil", Transport, Chain>;

/**
 * Minimal contract: only `balanceOf` reading a mapping (standard ERC-20 layout for that field).
 * Compiled with Solidity 0.8.28 (forge); used to exercise storage probing without a mainnet fork.
 */
const MINI_ERC20_BALANCE_BYTECODE =
  "0x6080604052348015600f57600080fd5b5060c980601d6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c806370a0823114602d575b600080fd5b605360383660046065565b6001600160a01b031660009081526020819052604090205490565b60405190815260200160405180910390f35b600060208284031215607657600080fd5b81356001600160a01b0381168114608c57600080fd5b939250505056fea26469706673582212203a60e53c0c5b746674072b349237ab27acefbaee2cb32c31c53928400fd1e1b264736f6c634300081c0033" as const satisfies Hex;

describe("dealErc20Balance", () => {
  test("throws when testClient is not in anvil mode", async () => {
    const testClient = { mode: "hardhat" } as unknown as AnvilTestClient;

    await expect(
      dealErc20Balance({
        testClient,
        token: "0x0000000000000000000000000000000000000001",
        recipient: "0x0000000000000000000000000000000000000002",
        amount: 1n,
      }),
    ).rejects.toThrow(/Anvil-mode test clients/i);
  });

  test("sets balanceOf via storage deal on a local ERC-20-shaped contract", async () => {
    const runtime = await startRuntime({ mode: "chain", chainId: 31_337 });
    try {
      const { testClient, walletClient, publicClient } = createClients(runtime, { chainId: 31_337 });
      const account = walletClient.account;
      if (!account) {
        throw new Error("createClients must set walletClient.account.");
      }

      const hash = await walletClient.deployContract({
        abi: erc20Abi,
        bytecode: MINI_ERC20_BALANCE_BYTECODE,
        account,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const token = receipt.contractAddress;
      if (!token) {
        throw new Error("Expected contract address from deployment receipt.");
      }

      const recipient = "0x1111111111111111111111111111111111111111" as Address;
      const amount = 9_999_000_000n;

      await dealErc20Balance({
        testClient,
        token,
        recipient,
        amount,
      });

      const balance = await readContract(publicClient, {
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [recipient],
      });

      expect(balance).toBe(amount);
    } finally {
      await stopRuntime(runtime);
    }
  });
});

describe("dealErc20Balance (failure paths)", () => {
  let runtime: RuntimeHandle;
  let testClient: AnvilTestClient;

  beforeAll(async () => {
    runtime = await startRuntime({ mode: "chain", chainId: 31_337 });
    ({ testClient } = createClients(runtime, { chainId: 31_337 }));
  });

  afterAll(async () => {
    await stopRuntime(runtime);
  });

  test("throws when no valid balance slot is found", async () => {
    await expect(
      dealErc20Balance({
        testClient,
        token: "0x0000000000000000000000000000000000000001",
        recipient: "0x2222222222222222222222222222222222222222",
        amount: 1n,
      }),
    ).rejects.toThrow(/could not find a valid balanceOf storage slot/i);
  });
});
