import type { RunAuditOptions } from "../audit/engine.js";

export const auditScopeArgs = {
  all: { type: "boolean" as const, description: "Audit all source files.", default: false },
  changed: { type: "boolean" as const, description: "Audit changed and untracked source files.", default: false },
  base: { type: "string" as const, description: "Audit files changed since merge-base with this ref.", required: false },
};

interface AuditScopeCliArgs {
  _: unknown;
  all?: boolean;
  changed?: boolean;
  base?: string;
}

export function auditOptionsFromArgs(
  args: AuditScopeCliArgs,
  defaultMode: NonNullable<RunAuditOptions["mode"]>,
): Pick<RunAuditOptions, "mode" | "base" | "paths"> {
  const paths = Array.isArray(args._) ? args._.map(String) : [];
  const mode = paths.length > 0
    ? "paths"
    : args.base
      ? "base"
      : args.changed
        ? "changed"
        : args.all
          ? "all"
          : defaultMode;

  return {
    mode,
    base: args.base,
    paths,
  };
}
