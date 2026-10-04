import { lstat, readlink, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { FileOperation } from "../agents/agent.js";
import { managedBlockStart, managedBlockEnd, upsertManagedBlock } from "../agents/managed-block.js";

export async function operationIdentity(root: string, path: string): Promise<string> {
  try {
    return await realpath(join(root, path));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      const absolute = resolve(root, path);
      const metadata = await lstat(absolute).catch(() => null);
      if (metadata?.isSymbolicLink()) return operationIdentity(dirname(absolute), await readlink(absolute));
      const parent = await realpath(dirname(absolute)).catch(() => dirname(absolute));
      return join(parent, absolute.slice(dirname(absolute).length + 1));
    }
    throw error;
  }
}

/** Both readers and writers must agree on the contents of a shared instruction file. */
export async function shareInstructionBlocks(root: string, operations: FileOperation[]): Promise<FileOperation[]> {
  const groups = new Map<string, FileOperation[]>();
  for (const operation of operations) {
    if (operation.path !== "AGENTS.md" && operation.path !== "CLAUDE.md") continue;
    const identity = await operationIdentity(root, operation.path);
    groups.set(identity, [...groups.get(identity) ?? [], operation]);
  }
  const contents = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const lines = group.flatMap(({ content }) => {
      const start = content.indexOf(managedBlockStart);
      const end = content.indexOf(managedBlockEnd, start);
      return start < 0 || end < 0 ? [] : content.slice(start + managedBlockStart.length, end).trim().split("\n");
    });
    const body = [...new Set(lines)].join("\n");
    // Cleanup operations for retired agents have no block; the active block wins.
    const content = body ? upsertManagedBlock(group[0].content, body) : group[0].content;
    for (const operation of group) contents.set(operation.path, content);
  }
  return operations.map((operation) => ({ ...operation, content: contents.get(operation.path) ?? operation.content }));
}
