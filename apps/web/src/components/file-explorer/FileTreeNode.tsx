import { ChevronRightIcon } from "lucide-react";
import type { DirectoryEntry, GitFileStatus } from "@t3tools/contracts";
import { getVscodeIconUrlForEntry } from "../../vscode-icons";

const GIT_STATUS_LABELS: Record<GitFileStatus, { label: string; className: string }> = {
  modified: { label: "M", className: "text-yellow-500" },
  added: { label: "A", className: "text-green-500" },
  deleted: { label: "D", className: "text-red-500" },
  untracked: { label: "?", className: "text-gray-400" },
  renamed: { label: "R", className: "text-blue-500" },
  conflicted: { label: "U", className: "text-orange-500" },
};

interface FileTreeNodeProps {
  entry: DirectoryEntry;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  gitStatus: GitFileStatus | undefined;
  theme: "light" | "dark";
  onToggleExpand: (relativePath: string) => void;
  onSelectFile: (relativePath: string) => void;
  onContextMenu: (event: React.MouseEvent, entry: DirectoryEntry) => void;
}

export function FileTreeNode({
  entry,
  depth,
  isExpanded,
  isLoading,
  gitStatus,
  theme,
  onToggleExpand,
  onSelectFile,
  onContextMenu,
}: FileTreeNodeProps) {
  const isDir = entry.kind === "directory";
  const iconUrl = getVscodeIconUrlForEntry(entry.relativePath, entry.kind, theme);
  const statusInfo = gitStatus ? GIT_STATUS_LABELS[gitStatus] : undefined;

  const handleClick = () => {
    if (isDir) {
      onToggleExpand(entry.relativePath);
    } else {
      onSelectFile(entry.relativePath);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, entry)}
      className="group flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-accent/50"
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
    >
      {isDir ? (
        <ChevronRightIcon
          className={`size-3 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
        />
      ) : (
        <span className="size-3 shrink-0" />
      )}
      <img src={iconUrl} alt="" className="size-4 shrink-0" />
      <span className="flex-1 truncate">{entry.name}</span>
      {isLoading && <span className="animate-pulse text-[10px] text-muted-foreground">...</span>}
      {statusInfo && (
        <span className={`shrink-0 font-mono text-[10px] ${statusInfo.className}`}>
          {statusInfo.label}
        </span>
      )}
    </button>
  );
}
