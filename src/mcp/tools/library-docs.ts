import { resolveLibraryDocumentation, type LibraryDocumentationEntry } from "../../compose/library-docs.js";
import { detectStack } from "../../detect/stack.js";

export interface LibraryDocsResult {
  indexPath: ".ai/docs/llms.txt";
  packages: LibraryDocumentationEntry[];
}

export async function libraryDocsTool(rootDir: string): Promise<LibraryDocsResult> {
  const stack = await detectStack(rootDir);

  return {
    indexPath: ".ai/docs/llms.txt",
    packages: resolveLibraryDocumentation(stack),
  };
}
