import { describe, expect, test } from "vitest";
import { createClients } from "../src/index";

describe("createClients", () => {
  test("builds viem clients for a runtime handle", () => {
    const clients = createClients(
      {
        key: "t",
        rpcUrl: "http://127.0.0.1:8545",
        async stop() {
          // noop
        },
      },
      { chainId: 31_337 },
    );

    expect(clients.publicClient).toBeDefined();
    expect(clients.walletClient).toBeDefined();
    expect(clients.testClient).toBeDefined();
    expect(clients.account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});
