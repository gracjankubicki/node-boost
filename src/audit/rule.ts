import type { SourceFile } from "ts-morph";
import type { ArchitectureSlug, DetectedStack, StackName } from "../types.js";
import type { NodeBoostConfig } from "../config/schema.js";

export type AuditSeverity = "err" | "warn";
export type RuleSeverity = AuditSeverity | "off";
export type AuditRuleKind = "line" | "ast" | "project";

export interface AuditFinding {
  rule: string;
  sev: AuditSeverity;
  file: string;
  line: number;
  code: string;
  ref?: string;
}

export interface AuditFile {
  path: string;
  absolutePath: string;
  content: string;
  lines: string[];
  sourceFile: SourceFile | null;
  skipped: boolean;
}

export interface AuditRule {
  id: string;
  code: string;
  architecture: ArchitectureSlug;
  defaultSeverity: AuditSeverity;
  stacks: StackName[];
  kind: AuditRuleKind;
  check(context: AuditRuleContext): AuditFinding[];
}

export interface AuditRuleContext {
  rootDir: string;
  stack: DetectedStack;
  config: NodeBoostConfig;
  files: AuditFile[];
  allPaths: Set<string>;
  rule: AuditRule;
  severity: AuditSeverity;
  architectureOptions: Record<string, unknown>;
  ruleOptions: Record<string, unknown>;
}

export interface ExplainEntry {
  rule: string;
  code: string;
  severity: AuditSeverity;
  architecture: ArchitectureSlug;
  description: string;
  rationale: string;
  fix: string;
  guideline: string;
}

export interface AuditScopeResult {
  mode: "all" | "changed" | "base" | "paths";
  files: string[];
  warnings: AuditFinding[];
}

export interface AuditResult {
  v: 1;
  ok: boolean;
  cmd: "audit";
  scope: "all" | "changed" | "base" | "paths";
  err: number;
  warn: number;
  scanned: number;
  skipped: number;
  suppressed: number;
  elapsedMs: number;
  findings: AuditFinding[];
}
