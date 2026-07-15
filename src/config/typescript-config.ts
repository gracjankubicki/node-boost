import { dirname } from "node:path";
import { ts } from "ts-morph";

export interface TypeScriptConfigResult {
  configPath: string | null;
  compilerOptions: ts.CompilerOptions;
  strict: boolean | null;
  errors: readonly ts.Diagnostic[];
}

export function readTypeScriptConfig(rootDir: string): TypeScriptConfigResult {
  const configPath = ts.findConfigFile(rootDir, (path) => ts.sys.fileExists(path), "tsconfig.json");
  if (!configPath) {
    return { configPath: null, compilerOptions: {}, strict: null, errors: [] };
  }

  const config = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path));
  if (config.error) {
    return { configPath, compilerOptions: {}, strict: null, errors: [config.error] };
  }

  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath), undefined, configPath);
  return {
    configPath,
    compilerOptions: parsed.options,
    strict: typeof parsed.options.strict === "boolean" ? parsed.options.strict : null,
    errors: parsed.errors,
  };
}
