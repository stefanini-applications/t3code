import { useCallback, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { DirectoryEntry, EnvironmentId } from "@t3tools/contracts";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";

interface FileExplorerProps {
  environmentId: EnvironmentId;
  cwd: string;
  theme: "light" | "dark";
}

export function FileExplorer({ environmentId, cwd, theme }: FileExplorerProps) {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  const handleSelectFile = useCallback((relativePath: string) => {
    setActiveFilePath(relativePath);
  }, []);

  const handleContextMenu = useCallback((_event: React.MouseEvent, _entry: DirectoryEntry) => {
    // Context menu implementation in Task 10
  }, []);

  return (
    <Group orientation="horizontal" className="flex-1 min-h-0">
      <Panel defaultSize={30} minSize={15} maxSize={50} className="overflow-hidden">
        <FileTree
          environmentId={environmentId}
          cwd={cwd}
          theme={theme}
          onSelectFile={handleSelectFile}
          onContextMenu={handleContextMenu}
        />
      </Panel>
      <Separator className="w-px bg-border hover:bg-accent transition-colors data-[resize-handle-active]:bg-accent" />
      <Panel minSize={30} className="overflow-hidden">
        <CodeEditor
          environmentId={environmentId}
          cwd={cwd}
          activeFilePath={activeFilePath}
          onOpenFile={handleSelectFile}
        />
      </Panel>
    </Group>
  );
}
