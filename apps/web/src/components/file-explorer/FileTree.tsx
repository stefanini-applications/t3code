import { useEffect, useMemo, useState } from "react";
import type { DirectoryEntry, EnvironmentId } from "@t3tools/contracts";
import { useFileTree } from "./useFileTree";
import { useGitFileStatus } from "./useGitFileStatus";
import { FileTreeFilter } from "./FileTreeFilter";
import { FileTreeNode } from "./FileTreeNode";

interface FileTreeProps {
  environmentId: EnvironmentId;
  cwd: string;
  theme: "light" | "dark";
  onSelectFile: (relativePath: string) => void;
  onContextMenu: (event: React.MouseEvent, entry: DirectoryEntry) => void;
}

interface FlatEntry {
  entry: DirectoryEntry;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
}

export function FileTree({
  environmentId,
  cwd,
  theme,
  onSelectFile,
  onContextMenu,
}: FileTreeProps) {
  const { rootEntries, rootLoadState, rootError, expandedDirs, loadRoot, toggleExpand } =
    useFileTree({
      environmentId,
      cwd,
    });
  const { statusMap } = useGitFileStatus({
    environmentId,
    cwd,
    enabled: rootLoadState === "loaded",
  });
  const [filter, setFilter] = useState("");

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  // Flatten tree for rendering
  const flatEntries = useMemo(() => {
    if (!rootEntries) return [];
    const result: FlatEntry[] = [];
    const lowerFilter = filter.toLowerCase();

    function walk(entries: readonly DirectoryEntry[], depth: number) {
      for (const entry of entries) {
        const matchesFilter =
          lowerFilter.length === 0 || entry.name.toLowerCase().includes(lowerFilter);
        const dirData =
          entry.kind === "directory" ? expandedDirs.get(entry.relativePath) : undefined;
        const isExpanded = dirData !== undefined;
        const isLoading = dirData?.isLoading ?? false;
        const children = dirData?.entries ?? [];

        // For directories: show if matches filter OR has matching children
        // For files: show if matches filter
        if (entry.kind === "directory") {
          if (matchesFilter || lowerFilter.length === 0) {
            result.push({ entry, depth, isExpanded, isLoading });
          }
          if (isExpanded) {
            walk(children, depth + 1);
          }
        } else if (matchesFilter) {
          result.push({ entry, depth, isExpanded: false, isLoading: false });
        }
      }
    }

    walk(rootEntries, 0);
    return result;
  }, [rootEntries, expandedDirs, filter]);

  // Idle or loading: show loading indicator
  if (rootLoadState === "idle" || rootLoadState === "loading") {
    return (
      <div className="flex h-full flex-col">
        <FileTreeFilter value={filter} onChange={setFilter} />
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  // Error state: load was attempted and failed
  if (rootLoadState === "error") {
    return (
      <div className="flex h-full flex-col">
        <FileTreeFilter value={filter} onChange={setFilter} />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground">
          <span>{rootError ?? "Failed to load files"}</span>
          <button
            type="button"
            onClick={loadRoot}
            className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <FileTreeFilter value={filter} onChange={setFilter} />
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {flatEntries.map((item) => (
          <FileTreeNode
            key={item.entry.relativePath}
            entry={item.entry}
            depth={item.depth}
            isExpanded={item.isExpanded}
            isLoading={item.isLoading}
            gitStatus={statusMap.get(item.entry.relativePath)}
            theme={theme}
            onToggleExpand={toggleExpand}
            onSelectFile={onSelectFile}
            onContextMenu={onContextMenu}
          />
        ))}
        {flatEntries.length === 0 && rootEntries && (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            {filter.length > 0 ? "No matching files" : "Empty directory"}
          </div>
        )}
      </div>
    </div>
  );
}
