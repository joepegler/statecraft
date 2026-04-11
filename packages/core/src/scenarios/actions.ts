import {
  encodeDeployData,
  getContractAddress,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type Transport,
  type WalletClient,
} from "viem";
import { StatecraftError } from "./errors.js";

export type ActionPlanKind = "call" | "deployment";
export type ActionIdempotency = "idempotent-with-key" | "not-idempotent";

export type PreflightIssue = {
  code: string;
  reason: string;
  context?: Record<string, unknown>;
};

export type ActionPreflight = {
  canExecute: boolean;
  reasons: PreflightIssue[];
  assumptions: string[];
  estimatedEffects: Record<string, unknown>;
};

export type CallActionPlan = {
  kind: "call";
  to: Address;
  data: Hex;
  value?: bigint;
  chainId?: number;
};

export type DeploymentActionPlan = {
  kind: "deployment";
  abi: readonly unknown[];
  bytecode: Hex;
  args?: readonly unknown[];
  account: Account;
  chainId?: number;
};

export type ActionPlan = CallActionPlan | DeploymentActionPlan;
export type ActionSemantics = {
  kind: ActionPlanKind;
  idempotency: ActionIdempotency;
  retryGuidance: string;
};

export type PlanCallArgs = {
  to: Address;
  data: Hex;
  value?: bigint;
  chainId?: number;
};

export type PlanDeploymentArgs = {
  abi: readonly unknown[];
  bytecode: Hex;
  args?: readonly unknown[];
  account: Account;
  chainId?: number;
};

export type SimulateCallArgs = {
  publicClient: PublicClient<Transport, Chain>;
  plan: CallActionPlan;
  account?: Account;
};

export type SimulateDeploymentArgs = {
  publicClient: PublicClient<Transport, Chain>;
  plan: DeploymentActionPlan;
};

export type ExecutePlanArgs = {
  plan: ActionPlan;
  publicClient: PublicClient<Transport, Chain>;
  walletClient: WalletClient<Transport, Chain, Account | undefined>;
  account?: Account;
};

export type ExecutePlanResult =
  | {
      kind: "call";
      hash: Hex;
      receipt: TransactionReceipt;
    }
  | {
      kind: "deployment";
      hash: Hex;
      receipt: TransactionReceipt;
      contractAddress: Address | undefined;
    };

export function planCall(args: PlanCallArgs): { plan: CallActionPlan } {
  return {
    plan: {
      kind: "call",
      to: args.to,
      data: args.data,
      value: args.value,
      chainId: args.chainId,
    },
  };
}

export function describeActionSemantics(kind: ActionPlanKind): ActionSemantics {
  if (kind === "call") {
    return {
      kind,
      idempotency: "not-idempotent",
      retryGuidance: "Safe retries require an external idempotency key and nonce strategy.",
    };
  }
  return {
    kind,
    idempotency: "not-idempotent",
    retryGuidance: "Deployments are nonce-sensitive; retry only after checking sender nonce and previous receipts.",
  };
}

export function planDeployment(args: PlanDeploymentArgs): { plan: DeploymentActionPlan } {
  return {
    plan: {
      kind: "deployment",
      abi: args.abi,
      bytecode: args.bytecode,
      args: args.args ?? [],
      account: args.account,
      chainId: args.chainId,
    },
  };
}

export async function simulateCall(args: SimulateCallArgs): Promise<ActionPreflight> {
  const reasons: PreflightIssue[] = [];
  try {
    await args.publicClient.call({
      to: args.plan.to,
      data: args.plan.data,
      value: args.plan.value,
      account: args.account ?? undefined,
    });
  } catch (error) {
    reasons.push({
      code: "CALL_SIMULATION_FAILED",
      reason: error instanceof Error ? error.message : "Call simulation failed.",
    });
  }

  return {
    canExecute: reasons.length === 0,
    reasons,
    assumptions: [
      "Simulation outcome assumes chain state and block context stay unchanged before execution.",
    ],
    estimatedEffects: {
      kind: "call",
      to: args.plan.to,
      value: args.plan.value ?? 0n,
    },
  };
}

export async function simulateDeployment(args: SimulateDeploymentArgs): Promise<ActionPreflight> {
  const reasons: PreflightIssue[] = [];
  let estimatedGas: bigint | undefined;
  let predictedAddress: Address | undefined;
  try {
    estimatedGas = await args.publicClient.estimateContractGas({
      abi: args.plan.abi as never,
      bytecode: args.plan.bytecode,
      args: (args.plan.args ?? []) as readonly unknown[],
      account: args.plan.account,
    });

    const nonce = await args.publicClient.getTransactionCount({
      address: args.plan.account.address,
    });
    predictedAddress = getContractAddress({
      from: args.plan.account.address,
      nonce,
    });
  } catch (error) {
    reasons.push({
      code: "DEPLOYMENT_SIMULATION_FAILED",
      reason: error instanceof Error ? error.message : "Deployment simulation failed.",
    });
  }

  return {
    canExecute: reasons.length === 0,
    reasons,
    assumptions: [
      "Predicted deployment address assumes sender nonce remains unchanged before execution.",
      "Estimated gas assumes chain base fee and mempool conditions remain stable.",
    ],
    estimatedEffects: {
      kind: "deployment",
      estimatedGas,
      predictedAddress,
    },
  };
}

export async function executePlan(args: ExecutePlanArgs): Promise<ExecutePlanResult> {
  if (args.plan.kind === "call") {
    const account = args.account ?? args.walletClient.account;
    if (!account) {
      throw new StatecraftError({
        code: "SC_PRECONDITION_FAILED",
        reason: "executePlan(call) requires a wallet account.",
        suggestedAction: "Pass ExecutePlanArgs.account or configure walletClient.account.",
      });
    }
    const hash = await args.walletClient.sendTransaction({
      account,
      to: args.plan.to,
      data: args.plan.data,
      value: args.plan.value ?? 0n,
      chain: args.walletClient.chain,
    });
    const receipt = await args.publicClient.waitForTransactionReceipt({ hash });
    return {
      kind: "call",
      hash,
      receipt,
    };
  }

  const account = args.account ?? args.plan.account ?? args.walletClient.account;
  if (!account) {
    throw new StatecraftError({
      code: "SC_PRECONDITION_FAILED",
      reason: "executePlan(deployment) requires an account.",
      suggestedAction: "Provide an account in planDeployment(...) or executePlan(...).",
    });
  }

  const data = encodeDeployData({
    abi: args.plan.abi as never,
    bytecode: args.plan.bytecode,
    args: (args.plan.args ?? []) as readonly unknown[],
  });
  const hash = await args.walletClient.sendTransaction({
    account,
    data,
    chain: args.walletClient.chain,
  });
  const receipt = await args.publicClient.waitForTransactionReceipt({ hash });
  return {
    kind: "deployment",
    hash,
    receipt,
    contractAddress: receipt.contractAddress,
  };
}
