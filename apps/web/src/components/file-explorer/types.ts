import type { DirectoryEntry, GitFileStatus } from "@t3tools/contracts";

export interface TreeNode {
  readonly entry: DirectoryEntry;
  readonly depth: number;
  readonly isExpanded: boolean;
  readonly isLoading: boolean;
  readonly children: readonly TreeNode[] | null; // null = not loaded yet
  readonly gitStatus?: GitFileStatus | undefined;
}

export interface FileTreeState {
  readonly rootPath: string;
  readonly nodes: ReadonlyMap<string, TreeNode>;
  readonly expandedPaths: ReadonlySet<string>;
  readonly rootEntries: readonly DirectoryEntry[];
}
