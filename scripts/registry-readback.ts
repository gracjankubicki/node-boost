import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";

import { verifyRegistryRelease, type RegistryReadback } from "./registry-readback-lib.js";

const execFileAsync = promisify(execFile);
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
  name?: string;
  version?: string;
};

if (!packageJson.name || !packageJson.version) {
  throw new Error("package.json must contain a package name and version.");
}

const packageSpec = `${packageJson.name}@${packageJson.version}`;
const readback = await verifyRegistryRelease({
  packageName: packageJson.name,
  version: packageJson.version,
  attempts: 6,
  delayMs: 2_000,
  load: async () => {
    const { stdout } = await execFileAsync("npm", ["view", packageSpec, "--json"]);
    return JSON.parse(stdout) as RegistryReadback;
  },
  sleep: setTimeout,
  onRetry: (error, attempt) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`registry readback attempt ${attempt} failed: ${message}; retrying\n`);
  },
});

process.stdout.write(`registry release verified: ${packageSpec} (${readback.dist.integrity})\n`);
