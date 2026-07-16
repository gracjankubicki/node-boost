import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
  name?: string;
  version?: string;
};

if (!packageJson.name || !packageJson.version) {
  throw new Error("package.json must contain a package name and version.");
}

const packageSpec = `${packageJson.name}@${packageJson.version}`;
const { stdout } = await execFileAsync("npm", ["view", packageSpec, "--json"]);
const readback = JSON.parse(stdout) as {
  name?: string;
  version?: string;
  dist?: { integrity?: string; attestations?: unknown };
};

if (readback.name !== packageJson.name || readback.version !== packageJson.version) {
  throw new Error(`Registry readback does not match ${packageSpec}.`);
}
if (!readback.dist?.integrity) {
  throw new Error(`Registry readback for ${packageSpec} is missing dist.integrity.`);
}
if (!isNonEmptyObject(readback.dist.attestations)) {
  throw new Error(`Registry readback for ${packageSpec} is missing provenance attestations.`);
}

process.stdout.write(`registry release verified: ${packageSpec} (${readback.dist.integrity})\n`);

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.keys(value).length > 0;
}
