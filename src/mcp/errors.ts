export class NodeBoostMcpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "NodeBoostMcpError";
  }
}

export function formatMcpError(error: unknown): string {
  if (error instanceof NodeBoostMcpError) {
    return `${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return `NB-E500: ${error.message}`;
  }

  return "NB-E500: Unknown MCP tool error.";
}

export function isDebugEnabled(): boolean {
  return process.env.NODE_BOOST_DEBUG === "1";
}

export function debugLog(message: string): void {
  if (isDebugEnabled()) {
    process.stderr.write(`${message}\n`);
  }
}
