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

  const range = managedBlockRange(existingContent);
  if (range) {
    return `${existingContent.slice(0, range.start)}${block}${existingContent.slice(range.end)}`;
  }

  const separator = existingContent.endsWith("\n") ? "\n" : "\n\n";
  return `${existingContent}${separator}${block}`;
}

export function removeManagedBlock(existingContent: string | null): string | null {
  if (existingContent === null) {
    return null;
  }

  const range = managedBlockRange(existingContent);
  if (!range) {
    return existingContent;
  }

  return `${existingContent.slice(0, range.start)}${existingContent.slice(range.end)}`;
}

function managedBlockRange(content: string): { start: number; end: number } | null {
  const start = content.indexOf(managedBlockStart);
  if (start === -1) {
    return null;
  }

  const markerEnd = content.indexOf(managedBlockEnd, start + managedBlockStart.length);
  if (markerEnd === -1) {
    return null;
  }

  let end = markerEnd + managedBlockEnd.length;
  if (content[end] === "\r" && content[end + 1] === "\n") {
    end += 2;
  } else if (content[end] === "\n") {
    end += 1;
  }

  return { start, end };
}
