import type { RuntimeHandle } from "@statecraft/runtime";
import type { PublicClient, WalletClient, TestClient, Transport, Chain, Account, Hex, TransactionReceipt } from "viem";

export type ContractArtifact = {
  abi?: readonly unknown[];
  bytecode?: Hex | { object?: Hex };
  deployedBytecode?: Hex | { object?: Hex };
};

export type ScenarioContracts = Record<string, unknown | { address: Hex }>;

export type DeploymentRecord = {
  address: Hex;
  receipt: TransactionReceipt;
  contract: unknown | { address: Hex };
};

export type ScenarioContext = {
  runtime?: RuntimeHandle;
  publicClient?: PublicClient<Transport, Chain>;
  walletClient?: WalletClient<Transport, Chain, Account | undefined>;
  testClient?: TestClient<"anvil", Transport, Chain>;
  wallet?: Hex;
  contracts?: ScenarioContracts;
  deployments?: Record<string, DeploymentRecord>;
};

export type ScenarioTest<Ctx extends ScenarioContext = ScenarioContext> = (ctx: Ctx) => Promise<void> | void;

export type ScenarioStep<In extends ScenarioContext = ScenarioContext, Out extends ScenarioContext = ScenarioContext> = (
  ctx: In,
  next: (ctx: Out) => Promise<void>,
) => Promise<void>;
