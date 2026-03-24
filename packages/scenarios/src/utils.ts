import type { ContractArtifact, ScenarioContext } from "./types";
import type { Hex } from "viem";

export function requireRuntimeClients(ctx: ScenarioContext): asserts ctx is ScenarioContext & {
  runtime: NonNullable<ScenarioContext["runtime"]>;
  publicClient: NonNullable<ScenarioContext["publicClient"]>;
  walletClient: NonNullable<ScenarioContext["walletClient"]>;
  testClient: NonNullable<ScenarioContext["testClient"]>;
} {
  if (!ctx.runtime || !ctx.publicClient || !ctx.walletClient || !ctx.testClient) {
    throw new Error("Scenario context is missing runtime clients. Compose with withChain(...) or withFork(...) first.");
  }
}

export function extractBytecode(value: ContractArtifact["bytecode"] | ContractArtifact["deployedBytecode"], label: string): Hex {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value;
  }

  if (value && typeof value === "object" && typeof value.object === "string" && value.object.startsWith("0x")) {
    return value.object;
  }

  throw new Error(`${label} is missing usable bytecode (expected a 0x-prefixed hex string).`);
}
