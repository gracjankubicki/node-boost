import { describe, expect, it, vi } from "vitest";

import { verifyRegistryRelease } from "../../scripts/registry-readback-lib.js";

const completeReadback = {
  name: "@node-boost/node-boost",
  version: "0.3.0",
  dist: {
    integrity: "sha512-example",
    attestations: { provenance: { predicateType: "https://slsa.dev/provenance/v1" } },
  },
};

describe("registry release readback", () => {
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
