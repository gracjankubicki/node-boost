import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const tag = process.argv[2];

if (!tag) {
  throw new Error("Usage: npm run release:check -- v<package-version>");
}

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
if (!packageJson.version) {
  throw new Error("package.json must contain a version.");
}

const expectedTag = `v${packageJson.version}`;
if (tag !== expectedTag) {
  throw new Error(`Release tag ${tag} does not match package version ${packageJson.version}.`);
}

const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
if (!changelog.split("\n").some((line) => line.startsWith(`## ${packageJson.version} `))) {
  throw new Error(`CHANGELOG.md is missing a versioned ${packageJson.version} section.`);
}

await execFileAsync("git", ["show-ref", "--verify", `refs/tags/${tag}`]).catch((error: unknown) => {
  throw new Error(`Release tag ${tag} does not exist as an exact Git tag.`, { cause: error });
});
const head = (await execFileAsync("git", ["rev-parse", "HEAD"])).stdout.trim();
const tagged = (await execFileAsync("git", ["rev-list", "-n", "1", `refs/tags/${tag}`])).stdout.trim();
if (head !== tagged) {
  throw new Error(`Release tag ${tag} points to ${tagged}, but the checked out commit is ${head}.`);
}

process.stdout.write(`release metadata verified: ${tag} -> ${head}\n`);
