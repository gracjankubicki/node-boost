import { defineCommand } from "citty";
import { runAudit } from "../../audit/engine.js";
import { renderAgentReport } from "../../audit/reporters/agent.js";
import { runGuardHook, unsupportedHookAgent } from "../../hooks/adapter.js";
import { InvalidHookPayloadError, parseHookPayload } from "../../hooks/payload.js";
import type { AgentName } from "../../types.js";
import { auditOptionsFromArgs, auditScopeArgs } from "../audit-scope.js";
import { handleCliError } from "../errors.js";

const hookAgents = new Set(["claude-code", "codex", "cursor"]);

export const guardCommand = defineCommand({
  meta: {
    name: "guard",
    description: "Run audit as a hard gate for CI or agent hooks.",
  },
  args: {
    ...auditScopeArgs,
    hook: { type: "string", description: "Respond using a hook protocol: claude-code, codex, cursor.", required: false },
  },
  async run({ args }) {
    try {
      if (args.hook) {
        if (!hookAgents.has(args.hook)) {
          const response = unsupportedHookAgent(args.hook);
          process.stdout.write(response.stdout);
          process.stderr.write(response.stderr);
          process.exitCode = response.exitCode;
          return;
        }

        const rawPayload = await readStdin();
        const response = await runGuardHook(parseHookPayload(args.hook as AgentName, rawPayload));
        process.stdout.write(response.stdout);
        process.stderr.write(response.stderr);
        process.exitCode = response.exitCode;
        return;
      }

      const result = await runAudit(auditOptionsFromArgs(args, "changed"));
      process.stdout.write(renderAgentReport(result));
      process.exitCode = result.err > 0 ? 1 : 0;
    } catch (error) {
      if (error instanceof InvalidHookPayloadError) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
        return;
      }

      if (handleCliError(error)) {
        return;
      }

      throw error;
    }
  },
});

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString("utf8");
}
