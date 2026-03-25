import {
  type Address,
  type Chain,
  type TestClient,
  type Transport,
  encodeFunctionData,
  erc20Abi,
  numberToHex,
} from "viem";
import { createAccessList, readContract, setStorageAt } from "viem/actions";

type AnvilTestClient = TestClient<"anvil", Transport, Chain>;

/**
 * Seeds an ERC-20 `balanceOf(recipient)` result by writing the underlying storage slot.
 * Intended for Anvil (or compatible) test nodes with `eth_createAccessList`, `eth_call` state overrides, and `anvil_setStorageAt`.
 *
 * @internal Implementation detail for {@link withErc20Balance}; may change if the storage backend is swapped.
 */
export async function dealErc20Balance({
  testClient,
  token,
  recipient,
  amount,
}: {
  testClient: AnvilTestClient;
  token: Address;
  recipient: Address;
  amount: bigint;
}): Promise<void> {
  if (testClient.mode !== "anvil") {
    throw new Error(
      `ERC-20 balance dealing is only supported on Anvil-mode test clients (got mode "${testClient.mode}").`,
    );
  }

  const value = numberToHex(amount, { size: 32 });
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [recipient],
  });

  let accessList;
  try {
    const result = await createAccessList(testClient, {
      to: token,
      data,
    });
    accessList = result.accessList;
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `Unsupported runtime or RPC for ERC-20 balance dealing: eth_createAccessList failed (${message}).`,
      { cause: cause instanceof Error ? cause : undefined },
    );
  }

  for (const { address: address_, storageKeys } of accessList) {
    const address = address_.toLowerCase() as Address;

    for (const slot of storageKeys) {
      try {
        const balance = await readContract(testClient, {
          abi: erc20Abi,
          address: token,
          functionName: "balanceOf",
          args: [recipient],
          stateOverride: [
            {
              address,
              stateDiff: [{ slot, value }],
            },
          ],
        });

        if (balance === amount) {
          await setStorageAt(testClient, { address, index: slot, value });
          return;
        }
      } catch {
        // Try next candidate slot (mirrors viem-deal probing).
      }
    }
  }

  throw new Error(
    `Balance deal failed for token "${token}": could not find a valid balanceOf storage slot for recipient "${recipient}".`,
  );
}
