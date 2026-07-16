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
  load: () => Promise<RegistryReadback>;
  sleep: (delayMs: number) => Promise<unknown>;
  onRetry?: (error: unknown, attempt: number) => void;
}

export async function verifyRegistryRelease({
  packageName,
  version,
  attempts,
  delayMs,
  load,
  sleep,
  onRetry,
}: VerifyRegistryReleaseOptions): Promise<VerifiedRegistryReadback> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error("Registry readback attempts must be a positive integer.");
  }

  const packageSpec = `${packageName}@${version}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const readback = await load();
      validateReadback(readback, packageName, version, packageSpec);
      return readback;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      onRetry?.(error, attempt);
      await sleep(delayMs);
    }
  }

  throw new Error(
    `Registry readback for ${packageSpec} did not become consistent after ${attempts} attempts.`,
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
