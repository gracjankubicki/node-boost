import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { detectStack } from "../../detect/stack.js";
import { readBoostConfig } from "../project.js";

export interface DoctorCheck {
  id: "config-present" | "config-valid" | "generated-with-drift" | "stack-detected";
  status: "pass" | "warn" | "fail";
  message: string;
}

export interface DoctorResult {
  ok: boolean;
  checks: DoctorCheck[];
}

export async function doctorTool(rootDir: string, boostVersion: string): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];
  const configRaw = await readConfigRaw(rootDir);
  const boostConfig = await readBoostConfig(rootDir);
  const stack = await detectStack(rootDir);

  checks.push({
    id: "config-present",
    status: configRaw === null ? "fail" : "pass",
    message: configRaw === null ? "node-boost.json is missing. Run node-boost install." : "node-boost.json is present.",
  });

  checks.push({
    id: "config-valid",
    status: boostConfig.config ? "pass" : "fail",
    message: boostConfig.config ? "node-boost.json is valid." : `node-boost.json is invalid: ${boostConfig.error?.message ?? "unknown error"}`,
  });

  checks.push({
    id: "generated-with-drift",
    status: !boostConfig.config || boostConfig.config.generatedWith === boostVersion ? "pass" : "warn",
    message: !boostConfig.config
      ? "No generatedWith drift can be checked without a valid config."
      : boostConfig.config.generatedWith === boostVersion
        ? "generatedWith matches the installed package version."
        : `generatedWith is ${boostConfig.config.generatedWith}, package is ${boostVersion}. Run node-boost update.`,
  });

  checks.push({
    id: "stack-detected",
    status: stack.name === "unknown" ? "fail" : "pass",
    message: stack.name === "unknown" ? "No supported React stack detected." : `Detected ${stack.name}.`,
  });

  return {
    ok: checks.every((check) => check.status !== "fail"),
    checks,
  };
}

async function readConfigRaw(rootDir: string): Promise<string | null> {
  try {
    return await readFile(join(rootDir, "node-boost.json"), "utf8");
  } catch {
    return null;
  }
}
