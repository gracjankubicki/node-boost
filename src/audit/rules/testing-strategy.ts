import picomatch from "picomatch";
import { isTestFile } from "../../detect/testing.js";
import type { AuditRule } from "../rule.js";

export const testingStrategyRules: AuditRule[] = [{
  id: "NB-ARCH-015", code: "missing-tests", architecture: "testing-strategy",
  defaultSeverity: "warn", stacks: ["next", "vite-react", "astro"], kind: "project",
  check(context) {
    if (picomatch(context.config.audit.exclude)("package.json")) return [];
    if ((context.stack.testTools?.length ?? 0) > 0 || [...context.testPaths ?? context.allPaths].some(isTestFile)) return [];
    return [{ rule: "NB-ARCH-015", sev: "warn", file: "package.json", line: 1, code: "missing-tests" }];
  },
}];
