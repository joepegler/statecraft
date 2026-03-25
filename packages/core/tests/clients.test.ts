import { createServer } from "node:http";
import { describe, expect, test } from "vitest";
import { defineChain, type Address } from "viem";
import { createClients, createBundlerClient } from "../src/clients/index.js";
import type { UserOperation } from "../src/clients/index.js";

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

describe("createBundlerClient", () => {
  test("wires ERC-4337 JSON-RPC methods", async () => {
    const entryPoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as Address;
    const calls: Array<{ method: string; params: readonly unknown[] }> = [];

    const server = createServer((req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 404;
        res.end();
        return;
      }

      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        const body = JSON.parse(raw) as { jsonrpc?: string; id?: unknown; method?: string; params?: unknown[] };
        const method = body.method;
        const params = (body.params ?? []) as readonly unknown[];

        if (typeof method !== "string") {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "missing method" }));
          return;
        }

        calls.push({ method, params });

        let result: unknown;
        switch (method) {
          case "eth_supportedEntryPoints": {
            result = [entryPoint];
            break;
          }
          case "eth_estimateUserOperationGas": {
            result = {
              // viem expects hex-encoded bigints over JSON-RPC.
              callGasLimit: "0x1",
              verificationGasLimit: "0x2",
              preVerificationGas: "0x3",
              maxFeePerGas: "0x4",
              maxPriorityFeePerGas: "0x5",
              someExtra: true,
            };
            break;
          }
          case "eth_sendUserOperation": {
            result = "0xabc" as const;
            break;
          }
          case "eth_getUserOperationReceipt": {
            result = null;
            break;
          }
          default: {
            res.statusCode = 500;
            res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { message: `unexpected method: ${method}` } }));
            return;
          }
        }

        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, result }));
      });
    });

    const port = await new Promise<number>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("failed to start bundler test server");
        resolve(address.port);
      });
    });

    try {
      const chain = defineChain({
        id: 31_337,
        name: "statecraft-test",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: ["http://127.0.0.1"] } },
      });

      const bundlerClient = createBundlerClient({
        bundlerUrl: `http://127.0.0.1:${port}`,
        chain,
        entryPoint,
      });

      const userOperation: UserOperation = {
        sender: entryPoint,
        nonce: 0n,
        initCode: "0x00",
        callData: "0x00",
        callGasLimit: 1n,
        verificationGasLimit: 2n,
        preVerificationGas: 3n,
        maxFeePerGas: 4n,
        maxPriorityFeePerGas: 5n,
        paymasterAndData: "0x00",
        signature: "0x00",
      };

      const supported = await bundlerClient.getSupportedEntryPoints();
      expect(supported).toEqual([entryPoint]);

      const estimate = await bundlerClient.estimateUserOperationGas(userOperation);
      expect(estimate.callGasLimit).toBe("0x1");

      const userOpHash = await bundlerClient.sendUserOperation(userOperation);
      expect(userOpHash).toBe("0xabc");

      const receipt = await bundlerClient.getUserOperationReceipt(userOpHash);
      expect(receipt).toBeNull();

      expect(calls.map((c) => c.method)).toEqual([
        "eth_supportedEntryPoints",
        "eth_estimateUserOperationGas",
        "eth_sendUserOperation",
        "eth_getUserOperationReceipt",
      ]);

      expect(calls[0]!.params.length).toBe(0);
      expect(calls[1]!.params.length).toBe(2);
      expect(calls[2]!.params.length).toBe(2);
      expect(calls[3]!.params.length).toBe(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
