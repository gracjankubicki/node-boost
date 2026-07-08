import type { AgentInstallerMap } from "./agent.js";
import { claudeCodeAgent } from "./claude-code.js";
import { codexAgent } from "./codex.js";
import { cursorAgent } from "./cursor.js";

export const agentInstallers: AgentInstallerMap = {
  "claude-code": claudeCodeAgent,
  codex: codexAgent,
  cursor: cursorAgent,
};
