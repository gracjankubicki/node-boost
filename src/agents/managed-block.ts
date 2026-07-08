export const managedBlockStart = "<!-- node-boost:start -->";
export const managedBlockEnd = "<!-- node-boost:end -->";

export function renderManagedBlock(body: string): string {
  return `${managedBlockStart}\n${body.trim()}\n${managedBlockEnd}\n`;
}

export function upsertManagedBlock(existingContent: string | null, body: string): string {
  const block = renderManagedBlock(body);

  if (!existingContent) {
    return block;
  }

  const pattern = new RegExp(`${escapeRegExp(managedBlockStart)}[\\s\\S]*?${escapeRegExp(managedBlockEnd)}\\n?`);

  if (pattern.test(existingContent)) {
    return existingContent.replace(pattern, block);
  }

  const separator = existingContent.endsWith("\n") ? "\n" : "\n\n";
  return `${existingContent}${separator}${block}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
