import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ZodError } from "zod";
import { normalizeArchitectures, parseNodeBoostConfig, type NodeBoostConfig } from "../config/schema.js";
import type { NormalizedArchitecture } from "../types.js";

export interface BoostConfigReadResult {
  config: NodeBoostConfig | null;
  architectures: NormalizedArchitecture[];
  error: Error | null;
}

export async function readBoostConfig(rootDir: string): Promise<BoostConfigReadResult> {
  try {
    const raw = await readFile(join(rootDir, "node-boost.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const config = parseNodeBoostConfig(parsed);
    return {
      config,
      architectures: normalizeArchitectures(config),
      error: null,
    };
  } catch (error) {
    return {
      config: null,
      architectures: [],
      error: normalizeConfigError(error),
    };
  }
}

export async function readTypescriptStrict(rootDir: string): Promise<boolean | null> {
  try {
    const raw = await readFile(join(rootDir, "tsconfig.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (isObject(parsed) && isObject(parsed.compilerOptions) && typeof parsed.compilerOptions.strict === "boolean") {
      return parsed.compilerOptions.strict;
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeConfigError(error: unknown): Error {
  if (error instanceof SyntaxError) {
    return new Error(`Invalid JSON: ${error.message}`, { cause: error });
  }

  if (error instanceof ZodError) {
    const message = error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ");
    return new Error(message, { cause: error });
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Unknown config error.");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
