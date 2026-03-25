import { EventEmitter } from "node:events";
import { readFile, access } from "node:fs/promises";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { Address } from "viem";
import { startBundler } from "./startBundler.js";

const ENTRYPOINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as Address;

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

type FakeChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
};

function createFakeChild(): FakeChild {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const child = new EventEmitter() as FakeChild;
  child.stdout = stdout;
  child.stderr = stderr;
  child.kill = vi.fn((signal?: NodeJS.Signals) => {
    queueMicrotask(() => {
      child.emit("exit", 0, null);
    });
  });
  return child;
}

/** Schedule I/O after `waitForListening` attaches listeners (spawn runs first, then listeners). */
function mockSpawnWithDeferredSetup(setup: (child: FakeChild) => void) {
  spawnMock.mockImplementation(() => {
    const fakeChild = createFakeChild();
    setImmediate(() => {
      setup(fakeChild);
    });
    return fakeChild;
  });
}

describe("startBundler", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("writes config, spawns Alto CLI, resolves when stdout shows listening, and stop removes temp dir", async () => {
    mockSpawnWithDeferredSetup((child) => {
      child.stdout.emit("data", Buffer.from("Server listening at http://127.0.0.1:4337\n"));
    });

    const result = await startBundler({
      rpcUrl: "http://127.0.0.1:8545",
      entryPoint: ENTRYPOINT,
    });

    expect(result.bundlerUrl).toMatch(/^http:\/\/127.0.0.1:\d+$/);
    const urlPort = new URL(result.bundlerUrl).port;

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [cmd, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe("node");
    expect(args[0]).toMatch(/alto\.js$/);
    expect(args[1]).toBe("--config");
    const configPath = args[2];
    expect(configPath).toMatch(/alto-config\.json$/);

    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed["rpc-url"]).toBe("http://127.0.0.1:8545");
    expect(parsed.port).toBe(Number(urlPort));
    expect(typeof parsed.entrypoints).toBe("string");
    expect(String(parsed.entrypoints)).toContain("0x0000000071727De22E5E9d8BAf0edAc6f37da032");
    expect(String(parsed.entrypoints)).toContain("0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789");

    await result.stop();

    await expect(access(configPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(spawnMock.mock.results[0]?.value.kill).toHaveBeenCalled();
  });

  test("stop is idempotent", async () => {
    mockSpawnWithDeferredSetup((child) => {
      child.stdout.emit("data", Buffer.from("Server listening at\n"));
    });

    const result = await startBundler({
      rpcUrl: "http://127.0.0.1:8545",
      entryPoint: ENTRYPOINT,
    });

    const fakeChild = spawnMock.mock.results[0]?.value as FakeChild;

    await result.stop();
    const killCallsAfterFirst = fakeChild.kill.mock.calls.length;
    await result.stop();
    expect(fakeChild.kill.mock.calls.length).toBe(killCallsAfterFirst);
  });

  test("rejects on stderr containing Error and kills the child", async () => {
    mockSpawnWithDeferredSetup((child) => {
      child.stderr.emit("data", Buffer.from("Error: cannot bind port\n"));
    });

    await expect(
      startBundler({
        rpcUrl: "http://127.0.0.1:8545",
        entryPoint: ENTRYPOINT,
      }),
    ).rejects.toThrow(/cannot bind port/);

    const child = spawnMock.mock.results[0]?.value as FakeChild;
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  test("rejects when the process exits before listening", async () => {
    mockSpawnWithDeferredSetup((child) => {
      child.emit("exit", 1, null);
    });

    await expect(
      startBundler({
        rpcUrl: "http://127.0.0.1:8545",
        entryPoint: ENTRYPOINT,
      }),
    ).rejects.toThrow(/exited during startup/);
  });

  test("rejects when listening message never arrives (timeout)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const fakeChild = createFakeChild();
    fakeChild.kill.mockImplementation(() => {});
    spawnMock.mockImplementation(() => fakeChild);

    const pending = startBundler({
      rpcUrl: "http://127.0.0.1:8545",
      entryPoint: ENTRYPOINT,
    });

    // Let real I/O (port + temp dir) finish so `waitForListening`'s timeout is scheduled.
    for (let i = 0; i < 200 && spawnMock.mock.calls.length === 0; i++) {
      await new Promise<void>((r) => setImmediate(r));
    }
    expect(spawnMock).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(12_000);

    await expect(pending).rejects.toThrow(/Timed out waiting for Alto/);
    expect(fakeChild.kill).toHaveBeenCalledWith("SIGTERM");
  });
});
