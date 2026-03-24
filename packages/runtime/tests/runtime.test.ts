import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { createRuntime, startRuntime, stopRuntime } from "../src/index";

const hasAnvil =
  spawnSync("anvil", ["--version"], { stdio: "ignore" }).status === 0;

describe("runtime", () => {
  test("createRuntime validates fork settings", () => {
    expect(() =>
      createRuntime({
        mode: "fork",
        blockNumber: 22_000_000n,
      }),
    ).toThrow("requires rpcUrl");
  });

  test.runIf(hasAnvil)(
    "startRuntime/stopRuntime works for chain mode",
    async () => {
      const runtime = await startRuntime({ mode: "chain", chainId: 31_337 });
      expect(runtime.rpcUrl).toContain("http://127.0.0.1:");
      await stopRuntime(runtime);
    },
  );
});
