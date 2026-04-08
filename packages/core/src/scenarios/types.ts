import type { RuntimeHandle, RuntimeMode } from "../runtime/index.js";
import type { BundlerClient } from "../clients/index.js";
import type {
  PublicClient,
  WalletClient,
  TestClient,
  Transport,
  Chain,
  Account,
  Hex,
  TransactionReceipt,
  Address,
} from "viem";

/**
 * Minimal contract build artifact: ABI plus creation and/or runtime bytecode.
 * Matches common Hardhat/Foundry artifact fields.
 */
export type ContractArtifact = {
  /** Contract ABI JSON; required for deployment and typed `getContract` clients. */
  abi?: readonly unknown[];
  /**
   * Creation bytecode for `deployContract` (or artifact-style `{ object: hex }`).
   * May be omitted when only injecting deployed code.
   */
  bytecode?: Hex | { object?: Hex };
  /**
   * Runtime bytecode for `setCode` / fork overrides (or artifact-style `{ object: hex }`).
   */
  deployedBytecode?: Hex | { object?: Hex };
};

/**
 * Named contracts on the scenario context: viem `getContract` instances or `{ address }` placeholders.
 */
export type ScenarioContracts = Record<string, unknown | { address: Hex }>;

/**
 * Result of deploying one contract in a scenario: address, receipt, and optional live contract handle.
 */
export type DeploymentRecord = {
  /** Contract address from the deployment transaction receipt. */
  address: Hex;
  /** Full transaction receipt from `waitForTransactionReceipt`. */
  receipt: TransactionReceipt;
  /**
   * Live contract client when an ABI was available at deploy time; otherwise a minimal `{ address }` shape.
   */
  contract: unknown | { address: Hex };
};

/**
 * Resolves constructor arguments for `DeploymentSpec` when static `args` are insufficient.
 * Runs after prior named deployments in the same config are available on `deployments`.
 */
export type DeploymentArgsResolver = (ctx: {
  /** Deployments keyed by name from earlier entries in the same `withDeployments` config and parent context. */
  deployments: Record<string, DeploymentRecord>;
}) => readonly unknown[] | Promise<readonly unknown[]>;

/**
 * Context before any fixture runs. The first step receives this shape from the scenario runner.
 */
export type EmptyScenarioContext = {};

/**
 * Per-chain EVM context: one Anvil runtime, viem clients, and chain-scoped state (wallet, contracts, bundler).
 */
export type ScenarioChainContext = {
  /** Live anvil handle for this chain entry. */
  runtime: RuntimeHandle;
  /** Runtime mode (`chain` or `fork`). */
  runtimeMode: RuntimeMode;
  /** Chain identity used by viem clients for this entry. */
  chain: Chain;
  publicClient: PublicClient<Transport, Chain>;
  /** Viem wallet client; may be replaced by {@link withFundedWallet} or {@link withImpersonation}. */
  walletClient: WalletClient<Transport, Chain, Account | undefined>;
  /** Viem anvil test client (snapshots, `setCode`, etc.). */
  testClient: TestClient<"anvil", Transport, Chain>;
  /** Address of the funded or impersonated wallet when a wallet fixture ran on this chain. */
  wallet?: Hex;
  /** Named contract handles from `withContracts` on this chain. */
  contracts?: ScenarioContracts;
  /** Named deployment records from `withDeployments` on this chain. */
  deployments?: Record<string, DeploymentRecord>;
  /** HTTP RPC endpoint for a local ERC-4337 bundler. Set by {@link withBundler} on this chain. */
  bundlerUrl?: string;
  /** Viem-compatible bundler client for RPC methods like `eth_sendUserOperation`. Set by {@link withBundler}. */
  bundlerClient?: BundlerClient;
  /** ERC-4337 entry point address used by the bundler instance. Set by {@link withBundler}. */
  entryPoint?: Address;
};

/**
 * Accumulated context passed through `withX` middleware. Runtime state lives under {@link ScenarioChainContext}
 * keyed by chain name (for example `ctx.chains.ethereum`).
 */
export type ScenarioContext = {
  chains?: Record<string, ScenarioChainContext>;
  bridge?: ScenarioBridge;
};

/**
 * Context after a runtime fixture (`withChain`, `withFork`, `withExternalRuntime`, or `withMultiChain`): at least one chain entry exists with clients.
 */
export type ScenarioRuntimeClientsContext = ScenarioContext & {
  chains: Record<string, ScenarioChainContext>;
};

/**
 * Context after {@link withFundedWallet}: the targeted chain entry includes `wallet`. Prefer reading `ctx.chains[chain].wallet`.
 */
export type ScenarioFundedWalletContext<ChainKey extends string = "default"> = ScenarioRuntimeClientsContext & {
  chains: ScenarioRuntimeClientsContext["chains"] & Record<ChainKey, ScenarioChainContext & { wallet: Hex }>;
};

/**
 * Context after {@link withBundler}: the targeted chain entry includes bundler fields.
 */
export type ScenarioBundlerContext = ScenarioRuntimeClientsContext;

/**
 * @deprecated Use {@link ScenarioBundlerContext}. Kept as a compatibility alias for older imports.
 */
export type BundlerContext = ScenarioBundlerContext;

/**
 * Native token sentinel address used by bridge test-doubles to represent chain native balance mutations.
 */
export const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Static route configuration for bridge simulation between two named chains.
 */
export type WithBridgeConfig = {
  /** Source chain key from `ctx.chains`. */
  srcChain: string;
  /** Destination chain key from `ctx.chains`. */
  destChain: string;
  /** Source asset address, or {@link NATIVE_TOKEN_ADDRESS} for native balance. */
  fromToken: Address;
  /** Destination asset address, or {@link NATIVE_TOKEN_ADDRESS} for native balance. */
  toToken: Address;
  /** Optional default source account; falls back to `ctx.chains[srcChain].wallet` at call time. */
  from?: Address;
  /** Optional default destination account; falls back to `ctx.chains[destChain].wallet` at call time. */
  to?: Address;
  /**
   * Divisor for bridge price math. Destination amount is `amountIn * price / priceScale`.
   * Defaults to `1n`.
   */
  priceScale?: bigint;
};

/**
 * Per-call bridge execution input.
 */
export type BridgeExecuteArgs = {
  /** Source amount debited from source chain/account. */
  amountIn: bigint;
  /** Bridge conversion price used for destination amount math. */
  price: bigint;
  /** Optional source account override for this execution. */
  from?: Address;
  /** Optional destination account override for this execution. */
  to?: Address;
};

/**
 * Result returned by one bridge simulation execution.
 */
export type BridgeExecution = {
  srcChain: string;
  destChain: string;
  fromToken: Address;
  toToken: Address;
  from: Address;
  to: Address;
  amountIn: bigint;
  amountOut: bigint;
  price: bigint;
};

/**
 * Callable bridge test-double exposed to tests through scenario context.
 */
export type ScenarioBridge = {
  execute(args: BridgeExecuteArgs): Promise<BridgeExecution>;
};

/**
 * Context after {@link withBridge}: includes a bridge executor chosen by the fixture config.
 */
export type ScenarioBridgeContext = ScenarioRuntimeClientsContext & {
  bridge: ScenarioBridge;
};

/** Context passed to `ContractInjection.afterSetCode` from `withContracts`. */
export type AfterSetCodeContext = {
  /** Chain key this injection ran on. */
  chain: string;
  /** Contract key from the `withContracts` config map. */
  name: string;
  /** Address where runtime bytecode was installed. */
  address: Hex;
  testClient: NonNullable<ScenarioChainContext["testClient"]>;
  publicClient: NonNullable<ScenarioChainContext["publicClient"]>;
  walletClient: NonNullable<ScenarioChainContext["walletClient"]>;
};

/** Context passed to `DeploymentSpec.afterDeploy` from `withDeployments`. */
export type AfterDeployContext = {
  /** Chain key this deployment ran on. */
  chain: string;
  /** Deployment key from the `withDeployments` config map. */
  name: string;
  /** Record for the deployment just completed. */
  deployment: DeploymentRecord;
  /** All deployments so far on this chain, including this one. */
  deployments: Record<string, DeploymentRecord>;
  /** Funded wallet address when `withFundedWallet` ran before this step on this chain; otherwise `undefined`. */
  wallet: Hex | undefined;
};

/** User test function run at the end of a `scenario(...)` chain. */
export type ScenarioTest<Ctx extends ScenarioContext = ScenarioContext> = (ctx: Ctx) => Promise<void> | void;

/**
 * One middleware layer: receives context, may enrich it, then must call `next` exactly once with the outgoing context.
 *
 * @typeParam In - Minimum context required before this step runs (often narrowed by prior fixtures).
 * @typeParam Out - Context shape after this step forwards to `next` (must include everything downstream needs).
 */
export type ScenarioStep<In extends ScenarioContext = ScenarioContext, Out extends ScenarioContext = ScenarioContext> = (
  ctx: In,
  next: (ctx: Out) => Promise<void>,
) => Promise<void>;
