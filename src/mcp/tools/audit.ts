import { runAudit } from "../../audit/engine.js";

export async function auditTool(rootDir: string) {
  return runAudit({ rootDir, mode: "all" });
}
