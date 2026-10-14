// npm may accept a publication minutes before registry metadata is visible.
export const registryReadbackPolicy = { attempts: 61, delayMs: 10_000, timeoutMs: 600_000 };

export function registryLookupTimeout(remainingMs: number): number {
  const timeout = Math.floor(Math.min(15_000, remainingMs));
  if (!Number.isFinite(timeout) || timeout < 1) {
    throw new Error("Registry lookup has no remaining whole millisecond budget.");
  }
  return timeout;
}

export interface RegistryReadback {
  name?: string;
  version?: string;
  dist?: { integrity?: string; attestations?: unknown };
}

interface VerifiedRegistryReadback extends RegistryReadback {
  name: string;
  version: string;
  dist: { integrity: string; attestations: Record<string, unknown> };
}

interface VerifyRegistryReleaseOptions {
  packageName: string;
  version: string;
  attempts: number;
  delayMs: number;
  timeoutMs?: number;
  now?: () => number;
  load: (remainingMs: number) => Promise<RegistryReadback>;
  sleep: (delayMs: number) => Promise<unknown>;
  onRetry?: (error: unknown, attempt: number) => void;
}

export async function verifyRegistryRelease({
  packageName,
  version,
  attempts,
  delayMs,
  timeoutMs,
  now = () => performance.now(),
  load,
  sleep,
  onRetry,
}: VerifyRegistryReleaseOptions): Promise<VerifiedRegistryReadback> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error("Registry readback attempts must be a positive integer.");
  }

  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error("Registry readback delay must be a finite nonnegative number.");
  }
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    throw new Error("Registry readback timeout must be a finite positive number.");
  }

  const startedAt = now();
  const budget = timeoutMs ?? Infinity;
  let attempted = 0;
  const packageSpec = `${packageName}@${version}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const remainingBeforeLoad = budget - (now() - startedAt);
    if (remainingBeforeLoad <= 0) break;
    attempted = attempt;
    try {
      const readback = await load(remainingBeforeLoad);
      if (now() - startedAt >= budget) {
        throw new Error(`Registry readback for ${packageSpec} exceeded its deadline.`);
      }
      validateReadback(readback, packageName, version, packageSpec);
      return readback;
    } catch (error) {
      lastError = error;
      const remaining = budget - (now() - startedAt);
      if (attempt === attempts || remaining <= 0) {
        break;
      }
      onRetry?.(error, attempt);
      await sleep(Math.min(delayMs, remaining));
    }
  }

  throw new Error(
    `Registry readback for ${packageSpec} did not become consistent after ${attempted} attempts${timeoutMs === undefined ? "" : ` within ${timeoutMs}ms`}.`,
    { cause: lastError },
  );
}

function validateReadback(
  readback: RegistryReadback,
  packageName: string,
  version: string,
  packageSpec: string,
): asserts readback is VerifiedRegistryReadback {
  if (readback.name !== packageName || readback.version !== version) {
    throw new Error(`Registry readback does not match ${packageSpec}.`);
  }
  if (!readback.dist?.integrity) {
    throw new Error(`Registry readback for ${packageSpec} is missing dist.integrity.`);
  }
  if (!isNonEmptyObject(readback.dist.attestations)) {
    throw new Error(`Registry readback for ${packageSpec} is missing provenance attestations.`);
  }
}

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.keys(value).length > 0;
}
