import { explainFinding } from "../../audit/registry.js";

export function explainFindingTool(rule: string) {
  const finding = explainFinding(rule);

  if (!finding) {
    return { ok: false, error: `Unknown node-boost rule "${rule}".` };
  }

  return { ok: true, finding };
}
