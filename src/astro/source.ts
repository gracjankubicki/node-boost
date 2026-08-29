import { parse } from "@astrojs/compiler";
import type { AttributeNode, DiagnosticMessage, Node, TagLikeNode } from "@astrojs/compiler/types";
import { is } from "@astrojs/compiler/utils";

export interface AstroIsland {
  component: string;
  directive: string;
  kind: "client" | "server";
  line: number | null;
}

export interface AstroHtmlSink {
  tag: string;
  expression: string;
  kind: AttributeNode["kind"];
  line: number | null;
}

export interface AstroSourceDocument {
  frontmatter: string | null;
  frontmatterLineOffset: number;
  islands: AstroIsland[];
  htmlSinks: AstroHtmlSink[];
  diagnostics: DiagnosticMessage[];
}

export async function parseAstroSource(source: string): Promise<AstroSourceDocument> {
  const result = await parse(source, { position: true });
  const islands: AstroIsland[] = [];
  const htmlSinks: AstroHtmlSink[] = [];
  let frontmatter: string | null = null;
  let frontmatterLineOffset = 0;

  visitAstroNodes(result.ast, (node) => {
    if (is.frontmatter(node)) {
      frontmatter = node.value;
      frontmatterLineOffset = Math.max(0, (node.position?.start.line ?? 1) - 1);
      return;
    }
    if (!is.tag(node)) {
      return;
    }

    collectIslands(node, islands);
    collectHtmlSinks(node, htmlSinks);
  });

  return {
    frontmatter,
    frontmatterLineOffset,
    islands,
    htmlSinks,
    diagnostics: result.diagnostics,
  };
}

function visitAstroNodes(node: Node, visitor: (node: Node) => void): void {
  visitor(node);
  if (!is.parent(node)) {
    return;
  }
  for (const child of node.children) {
    visitAstroNodes(child, visitor);
  }
}

function collectIslands(node: TagLikeNode, islands: AstroIsland[]): void {
  if (!is.component(node)) {
    return;
  }

  for (const attribute of node.attributes) {
    if (!attribute.name.startsWith("client:") && attribute.name !== "server:defer") {
      continue;
    }
    islands.push({
      component: node.name,
      directive: attribute.name,
      kind: attribute.name.startsWith("client:") ? "client" : "server",
      line: lineFor(node, attribute),
    });
  }
}

function collectHtmlSinks(node: TagLikeNode, htmlSinks: AstroHtmlSink[]): void {
  for (const attribute of node.attributes) {
    if (attribute.name !== "set:html") {
      continue;
    }
    htmlSinks.push({
      tag: node.name,
      expression: attribute.value,
      kind: attribute.kind,
      line: lineFor(node, attribute),
    });
  }
}

function lineFor(node: Node, attribute: AttributeNode): number | null {
  return attribute.position?.start.line ?? node.position?.start.line ?? null;
}
