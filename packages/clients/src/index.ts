import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  http,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PrivateKeyAccount,
  type PublicClient,
  type TestClient,
  type Transport,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { RuntimeHandle } from "@st8craft/runtime";

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

/**
 * Minimal viem-compatible JSON-RPC client wrapper for an ERC-4337 bundler endpoint.
 *
 * This is intentionally small, a runtime primitive rather than a high-level userOp framework.
 */
export type BundlerClient = {
  /** Returns the list of supported ERC-4337 entry point contract addresses. */
  getSupportedEntryPoints: () => Promise<Address[]>;

  /**
   * Calls `eth_estimateUserOperationGas` for a given user operation.
   *
   * The bundler may fill in or adjust gas fields; callers should merge the result into their userOp.
   */
  estimateUserOperationGas: (userOperation: UserOperation) => Promise<EstimateUserOperationGasResult>;

  /**
   * Calls `eth_sendUserOperation`.
   *
   * Returns the `userOpHash` as a hex string.
   */
  sendUserOperation: (userOperation: UserOperation) => Promise<Hex>;

  /**
   * Calls `eth_getUserOperationReceipt`.
   *
   * Returns `null` while the user operation is still pending.
   */
  getUserOperationReceipt: (userOpHash: Hex) => Promise<UserOperationReceipt | null>;
};

/**
 * ERC-4337 user operation shape as used by bundler JSON-RPC methods.
 */
export type UserOperation = {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
};

/**
 * Result shape for `eth_estimateUserOperationGas`.
 *
 * Alto follows the standard ERC-4337 estimate response, which includes gas fields that should be merged back into the `UserOperation`.
 */
export type EstimateUserOperationGasResult = {
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
} & Record<string, unknown>;

/**
 * Result shape for `eth_getUserOperationReceipt`.
 *
 * This type is intentionally permissive (bundlers may include additional fields).
 */
export type UserOperationReceipt = {
  userOpHash: Hex;
  entryPoint: Address;
  sender: Address;
  nonce: bigint;
  success?: boolean;
  actualGasUsed?: bigint;
  actualGasCost?: bigint;
  receipt?: TransactionReceipt;
  logs?: readonly unknown[];
} & Record<string, unknown>;

export type CreateBundlerClientArgs = {
  /** HTTP RPC URL for the local (or test) bundler instance. */
  bundlerUrl: string;
  /** Chain identity used for viem's RPC client wiring. */
  chain: Chain;
  /** ERC-4337 entry point contract address. */
  entryPoint: Address;
};

type JsonRpcMethod = "eth_supportedEntryPoints" | "eth_estimateUserOperationGas" | "eth_sendUserOperation" | "eth_getUserOperationReceipt";

function createJsonRpcRequest<T>(client: PublicClient, method: JsonRpcMethod, params: readonly unknown[]): Promise<T> {
  // viem types the request method as `never` for unknown method names depending on chain/transport,
  // so we keep this minimal and cast.
  return (client as any).request({ method, params }) as Promise<T>;
}

/**
 * Builds a bundler client over `args.bundlerUrl` using JSON-RPC `http` transport.
 */
export function createBundlerClient(args: CreateBundlerClientArgs): BundlerClient {
  const publicClient = createPublicClient({
    chain: args.chain,
    transport: http(args.bundlerUrl),
  });

  async function getSupportedEntryPoints(): Promise<Address[]> {
    return createJsonRpcRequest<Address[]>(publicClient, "eth_supportedEntryPoints", []);
  }

  async function estimateUserOperationGas(userOperation: UserOperation): Promise<EstimateUserOperationGasResult> {
    // Standard ERC-4337 signature: eth_estimateUserOperationGas(userOp, entryPoint)
    return createJsonRpcRequest<EstimateUserOperationGasResult>(publicClient, "eth_estimateUserOperationGas", [userOperation, args.entryPoint]);
  }

  async function sendUserOperation(userOperation: UserOperation): Promise<Hex> {
    // Standard ERC-4337 signature: eth_sendUserOperation(userOp, entryPoint)
    return createJsonRpcRequest<Hex>(publicClient, "eth_sendUserOperation", [userOperation, args.entryPoint]);
  }

  async function getUserOperationReceipt(userOpHash: Hex): Promise<UserOperationReceipt | null> {
    return createJsonRpcRequest<UserOperationReceipt | null>(publicClient, "eth_getUserOperationReceipt", [userOpHash]);
  }

  return {
    getSupportedEntryPoints,
    estimateUserOperationGas,
    sendUserOperation,
    getUserOperationReceipt,
  };
}
