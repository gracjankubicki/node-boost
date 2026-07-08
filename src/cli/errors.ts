import { isNodeBoostConfigMissingError } from "../audit/engine.js";

export function handleCliError(error: unknown): boolean {
  if (!isNodeBoostConfigMissingError(error)) {
    return false;
  }

  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
  return true;
}
