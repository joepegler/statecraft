import type { RuntimeHandle } from "@statecraft/runtime";
import type { PublicClient, WalletClient, TestClient, Transport, Chain, Account, Hex, TransactionReceipt } from "viem";

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
 * Context after {@link withChain} or {@link withFork}: runtime handle and viem clients are always set.
 */
export type ScenarioRuntimeClientsContext = ScenarioContext & {
  runtime: NonNullable<ScenarioContext["runtime"]>;
  publicClient: NonNullable<ScenarioContext["publicClient"]>;
  walletClient: NonNullable<ScenarioContext["walletClient"]>;
  testClient: NonNullable<ScenarioContext["testClient"]>;
};

/**
 * Context after {@link withFundedWallet}: funded account address is always set (in addition to runtime clients).
 */
export type ScenarioFundedWalletContext = ScenarioRuntimeClientsContext & {
  wallet: Hex;
};

/**
 * Accumulated context passed through `withX` middleware. Fields are added by fixtures (e.g. {@link withChain}).
 */
export type ScenarioContext = {
  /** Live anvil handle; set by `withChain` or `withFork`. */
  runtime?: RuntimeHandle;
  /** Viem public client; set with runtime fixtures. */
  publicClient?: PublicClient<Transport, Chain>;
  /** Viem wallet client; may be replaced by {@link withFundedWallet}. */
  walletClient?: WalletClient<Transport, Chain, Account | undefined>;
  /** Viem anvil test client (snapshots, `setCode`, etc.). */
  testClient?: TestClient<"anvil", Transport, Chain>;
  /** Address of the funded test wallet when `withFundedWallet` ran. */
  wallet?: Hex;
  /** Named contract handles from `withContracts` and merged across steps. */
  contracts?: ScenarioContracts;
  /** Named deployment records from `withDeployments` and merged across steps. */
  deployments?: Record<string, DeploymentRecord>;
};

/** Context passed to `ContractInjection.afterSetCode` from `withContracts`. */
export type AfterSetCodeContext = {
  /** Contract key from the `withContracts` config map. */
  name: string;
  /** Address where runtime bytecode was installed. */
  address: Hex;
  testClient: NonNullable<ScenarioContext["testClient"]>;
  publicClient: NonNullable<ScenarioContext["publicClient"]>;
  walletClient: NonNullable<ScenarioContext["walletClient"]>;
};

/** Context passed to `DeploymentSpec.afterDeploy` from `withDeployments`. */
export type AfterDeployContext = {
  /** Deployment key from the `withDeployments` config map. */
  name: string;
  /** Record for the deployment just completed. */
  deployment: DeploymentRecord;
  /** All deployments so far, including this one. */
  deployments: Record<string, DeploymentRecord>;
  /** Funded wallet address when `withFundedWallet` ran before this step; otherwise `undefined`. */
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
