import { describe, expect, test, vi } from "vitest";
import {
  describeActionSemantics,
  planCall,
  planDeployment,
  simulateCall,
  simulateDeployment,
} from "./actions.js";
import { assertPreflight } from "./preflight.js";

describe("action primitives", () => {
  test("plans call and deployment actions", () => {
    const call = planCall({
      to: "0x00000000000000000000000000000000000000a1",
      data: "0x1234",
    });
    const deployment = planDeployment({
      abi: [],
      bytecode: "0x6000",
      account: {
        address: "0x00000000000000000000000000000000000000a2",
        type: "json-rpc",
      } as any,
    });
    expect(call.plan.kind).toBe("call");
    expect(deployment.plan.kind).toBe("deployment");
  });

  test("simulateCall returns machine-readable failures", async () => {
    const publicClient = {
      call: vi.fn(async () => {
        throw new Error("reverted");
      }),
    } as any;
    const result = await simulateCall({
      publicClient,
      plan: {
        kind: "call",
        to: "0x00000000000000000000000000000000000000a1",
        data: "0x1234",
      },
    });
    expect(result.canExecute).toBe(false);
    expect(result.reasons[0]?.code).toBe("CALL_SIMULATION_FAILED");
    expect(() => assertPreflight(result)).toThrow(/preflight failed/i);
  });

  test("simulateDeployment includes estimated effects", async () => {
    const publicClient = {
      estimateContractGas: vi.fn(async () => 123n),
      getTransactionCount: vi.fn(async () => 7),
    } as any;
    const result = await simulateDeployment({
      publicClient,
      plan: {
        kind: "deployment",
        abi: [],
        bytecode: "0x6000",
        account: {
          address: "0x00000000000000000000000000000000000000a2",
          type: "json-rpc",
        } as any,
      },
    });
    expect(result.canExecute).toBe(true);
    expect(result.estimatedEffects).toMatchObject({ estimatedGas: 123n });
  });

  test("exposes idempotency metadata for action kinds", () => {
    const call = describeActionSemantics("call");
    const deployment = describeActionSemantics("deployment");
    expect(call.idempotency).toBe("not-idempotent");
    expect(deployment.idempotency).toBe("not-idempotent");
  });
});
