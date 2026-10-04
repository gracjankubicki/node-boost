import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { runAudit } from "../audit/engine.js";
import type { HookResponse } from "./adapter.js";
import type { EditHookPayload } from "./payload.js";

export async function runEditHook(root: string, payload: EditHookPayload): Promise<HookResponse> {
  const candidates = payload.agent === "codex" && payload.tool_name === "apply_patch"
    ? [...(payload.tool_input.command ?? "").matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)\r?$/gm)].map((match) => match[1])
    : /^(?:Write|Edit|MultiEdit)$/.test(payload.tool_name) && payload.tool_input.file_path ? [payload.tool_input.file_path] : [];
  const paths: string[] = [];
  for (const candidate of candidates) {
    const absolute = resolve(root, candidate);
    const logical = relative(root, absolute);
    if (!isAbsolute(candidate) && (logical === ".." || logical.startsWith("../") || logical.startsWith("..\\"))) continue;
    try {
      const physical = await realpath(absolute);
      const path = relative(root, physical);
      if (path === ".." || path.startsWith("../") || path.startsWith("..\\") || isAbsolute(path) || !(await stat(physical)).isFile()) continue;
      paths.push(path.replaceAll("\\", "/"));
    } catch { /* Deleted/nonexistent files cannot be audited; Stop remains the backstop. */ }
  }
  if (!paths.length) return { exitCode: 0, stdout: "{}\n", stderr: "" };
  const result = await runAudit({ rootDir: root, mode: "paths", paths: [...new Set(paths)], feedbackOnly: true });
  const context = result.findings.map((finding) => `${finding.file}:${finding.line} ${finding.rule} ${finding.code}${finding.ref ? ` (${finding.ref})` : ""}`).join("\n");
  const output = !context ? {} : payload.agent === "cursor" ? { additional_context: context }
    : { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context } };
  return { exitCode: 0, stdout: `${JSON.stringify(output)}\n`, stderr: "" };
}
