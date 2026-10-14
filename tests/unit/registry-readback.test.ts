import { describe, expect, it, vi } from "vitest";

import { registryLookupTimeout, registryReadbackPolicy, verifyRegistryRelease } from "../../scripts/registry-readback-lib.js";

const completeReadback = {
  name: "@node-boost/node-boost",
  version: "0.3.0",
  dist: {
    integrity: "sha512-example",
    attestations: { provenance: { predicateType: "https://slsa.dev/provenance/v1" } },
  },
};

describe("registry release readback", () => {
  it.each([[600_000.5, 15_000], [9_500.5, 9_500], [1.9, 1]])(
    "uses a positive integer lookup timeout within remaining %d ms",
    (remaining, expected) => {
      expect(registryLookupTimeout(remaining)).toBe(expected);
    },
  );
  it.each([0.5, 0, -1, NaN])("rejects lookup budgets that would disable timeout: %d", (remaining) => {
    expect(() => registryLookupTimeout(remaining)).toThrow("no remaining whole millisecond budget");
  });
  it("rejects a valid response that arrives after the deadline", async () => {
    let elapsed = 0;
    await expect(verifyRegistryRelease({
      packageName: completeReadback.name, version: completeReadback.version,
      ...registryReadbackPolicy, now: () => elapsed,
      load: () => { elapsed = 600_001; return Promise.resolve(completeReadback); },
      sleep: vi.fn(),
    })).rejects.toThrow("within 600000ms");
  });
  it("waits through minutes of npm processing using the production retry policy", async () => {
    let elapsed = 0;
    const result = await verifyRegistryRelease({
      packageName: completeReadback.name,
      version: completeReadback.version,
      ...registryReadbackPolicy,
      now: () => elapsed,
      load: () => {
        if (elapsed < 180_000) throw new Error("npm error 404: package is being processed");
        return Promise.resolve(completeReadback);
      },
      sleep: (delay) => { elapsed += delay; return Promise.resolve(); },
    });
    expect(result).toEqual(completeReadback);
    expect(elapsed).toBeGreaterThanOrEqual(180_000);
  });
  it("bounds elapsed time including slow npm requests", async () => {
    let elapsed = 0;
    const load = vi.fn(() => {
      elapsed += 15_000;
      throw new Error("npm timeout");
    });
    const sleep = vi.fn((delay: number) => { elapsed += delay; return Promise.resolve(); });
    await expect(verifyRegistryRelease({
      packageName: completeReadback.name, version: completeReadback.version,
      ...registryReadbackPolicy, now: () => elapsed, load, sleep,
    })).rejects.toThrow("within 600000ms");
    expect(elapsed).toBe(600_000);
    expect(load).toHaveBeenCalledTimes(24);
    expect(sleep).toHaveBeenCalledTimes(24);
  });

  it("passes the remaining budget to the final lookup and clips the final sleep", async () => {
    let elapsed = 0;
    const load = vi.fn((remainingMs: number) => {
      elapsed += Math.min(15_000, remainingMs);
      throw new Error("npm timeout");
    });
    await expect(verifyRegistryRelease({
      packageName: completeReadback.name, version: completeReadback.version,
      ...registryReadbackPolicy, timeoutMs: 26_000, now: () => elapsed, load,
      sleep: (delay) => { elapsed += delay; return Promise.resolve(); },
    })).rejects.toThrow("within 26000ms");
    expect(elapsed).toBe(26_000);
    expect(load.mock.calls.map(([remaining]) => remaining)).toEqual([26_000, 1_000]);
  });

  it.each([
    { ...completeReadback, name: "another-package" },
    { ...completeReadback, version: "0.2.0" },
    { ...completeReadback, dist: { attestations: completeReadback.dist.attestations } },
    { ...completeReadback, dist: { integrity: "sha512-example", attestations: {} } },
  ])("fails after the deadline when metadata stays invalid: %j", async (metadata) => {
    let elapsed = 0;
    const load = vi.fn(() => Promise.resolve(metadata));
    await expect(verifyRegistryRelease({
      packageName: completeReadback.name, version: completeReadback.version,
      ...registryReadbackPolicy, now: () => elapsed, load,
      sleep: (delay) => { elapsed += delay; return Promise.resolve(); },
    })).rejects.toThrow("did not become consistent");
    expect(elapsed).toBe(600_000);
    expect(load).toHaveBeenCalledTimes(60);
  });

  it("retains the registry error as the cause when the wait budget expires", async () => {
    let elapsed = 0;
    const failure = new Error("npm error 404");
    await expect(verifyRegistryRelease({
      packageName: completeReadback.name, version: completeReadback.version,
      ...registryReadbackPolicy, now: () => elapsed,
      load: () => { throw failure; },
      sleep: (delay) => { elapsed += delay; return Promise.resolve(); },
    })).rejects.toMatchObject({ cause: failure });
    expect(elapsed).toBe(600_000);
  });

  it.each([
    { attempts: 0 }, { attempts: 1.5 }, { delayMs: -1 }, { delayMs: NaN },
    { timeoutMs: 0 }, { timeoutMs: Infinity },
  ])("rejects invalid retry settings before contacting npm: %j", async (settings) => {
    const load = vi.fn();
    await expect(verifyRegistryRelease({
      packageName: completeReadback.name, version: completeReadback.version,
      ...registryReadbackPolicy, ...settings, load, sleep: vi.fn(),
    })).rejects.toThrow();
    expect(load).not.toHaveBeenCalled();
  });

  it("retries when a newly published version is not visible yet", async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("npm error 404 No match found for version 0.3.0"))
      .mockResolvedValueOnce(completeReadback);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await verifyRegistryRelease({
      packageName: "@node-boost/node-boost",
      version: "0.3.0",
      attempts: 3,
      delayMs: 10,
      load,
      sleep,
    });

    expect(result).toEqual(completeReadback);
    expect(load).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it("retries an incomplete readback until integrity and attestations are visible", async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({
        name: "@node-boost/node-boost",
        version: "0.3.0",
        dist: { integrity: "sha512-example" },
      })
      .mockResolvedValueOnce(completeReadback);

    const result = await verifyRegistryRelease({
      packageName: "@node-boost/node-boost",
      version: "0.3.0",
      attempts: 2,
      delayMs: 0,
      load,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual(completeReadback);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("fails after the bounded retry budget is exhausted", async () => {
    const load = vi.fn().mockRejectedValue(new Error("npm unavailable"));

    await expect(verifyRegistryRelease({
      packageName: "@node-boost/node-boost",
      version: "0.3.0",
      attempts: 3,
      delayMs: 0,
      load,
      sleep: vi.fn().mockResolvedValue(undefined),
    })).rejects.toThrow("did not become consistent after 3 attempts");

    expect(load).toHaveBeenCalledTimes(3);
  });
});
