import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  http,
  type Account,
  type Chain,
  type Hex,
  type PrivateKeyAccount,
  type PublicClient,
  type TestClient,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { RuntimeHandle } from "@statecraft/runtime";

const DEFAULT_CHAIN_ID = 31_337;
const DEFAULT_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/** Viem clients + account wired to a single HTTP transport for scenario tests. */
export type TestClients = {
  /** Read-only RPC client. */
  publicClient: PublicClient<Transport, Chain>;
  /** Signing client; `account` is set from options or the default dev key. */
  walletClient: WalletClient<Transport, Chain, Account | undefined>;
  /** Anvil controls: snapshots, `setBalance`, etc. */
  testClient: TestClient<"anvil", Transport, Chain>;
  /** Account used by `walletClient` (same as `privateKeyToAccount` for the chosen key). */
  account: PrivateKeyAccount;
};

/** Options for `createClients` (chain identity and signer). */
export type CreateClientsOptions = {
  /** Passed to `defineChain`; defaults to local dev chain id `31337`. */
  chainId?: number;
  /** Hex private key; defaults to Anvil’s first dev key when omitted. */
  privateKey?: Hex;
};

function createChain(chainId: number): Chain {
  return defineChain({
    id: chainId,
    name: `statecraft-${chainId}`,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ["http://127.0.0.1:8545"],
      },
    },
  });
}

/**
 * Builds viem public, wallet, and anvil test clients over `runtime.rpcUrl` using JSON-RPC `http` transport.
 */
export function createClients(runtime: RuntimeHandle, options: CreateClientsOptions = {}): TestClients {
  const chain = createChain(options.chainId ?? DEFAULT_CHAIN_ID);
  const transport = http(runtime.rpcUrl);
  const account = privateKeyToAccount(options.privateKey ?? DEFAULT_PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain,
    transport,
  });

  const walletClient = createWalletClient({
    chain,
    transport,
    account,
  });

  const testClient = createTestClient({
    chain,
    mode: "anvil",
    transport,
  });

  return {
    publicClient,
    walletClient,
    testClient,
    account,
  };
}
