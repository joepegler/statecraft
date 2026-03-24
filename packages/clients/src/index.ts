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

export type TestClients = {
  publicClient: PublicClient<Transport, Chain>;
  walletClient: WalletClient<Transport, Chain, Account | undefined>;
  testClient: TestClient<"anvil", Transport, Chain>;
  account: PrivateKeyAccount;
};

export type CreateClientsOptions = {
  chainId?: number;
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
