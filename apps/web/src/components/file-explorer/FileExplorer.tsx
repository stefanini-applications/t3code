import { useCallback, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { DirectoryEntry, EnvironmentId } from "@t3tools/contracts";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";
import { FileTreeContextMenu, type TreeContextAction } from "./FileTreeContextMenu";
import { readEnvironmentApi } from "../../environmentApi";
import { useComposerHandleContext } from "../../composerHandleContext";

interface FileExplorerProps {
  environmentId: EnvironmentId;
  cwd: string;
  theme: "light" | "dark";
}

export function FileExplorer({ environmentId, cwd, theme }: FileExplorerProps) {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: DirectoryEntry;
  } | null>(null);

  const composerHandleRef = useComposerHandleContext();

  const handleSelectFile = useCallback((relativePath: string) => {
    setActiveFilePath(relativePath);
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent, entry: DirectoryEntry) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, entry });
  }, []);

  const handleContextAction = useCallback(
    async (action: TreeContextAction, entry: DirectoryEntry) => {
      const api = readEnvironmentApi(environmentId);
      if (!api) return;

      switch (action) {
        case "newFile": {
          const name = window.prompt("File name:");
          if (!name) return;
          const relativePath = `${entry.relativePath}/${name}`;
          await api.projects.writeFile({ cwd, relativePath, contents: "" });
          setActiveFilePath(relativePath);
          break;
        }
        case "newFolder": {
          const name = window.prompt("Folder name:");
          if (!name) return;
          await api.filesystem.createDirectory({
            cwd,
            relativePath: `${entry.relativePath}/${name}`,
          });
          break;
        }
        case "rename": {
          const newName = window.prompt("New name:", entry.name);
          if (!newName || newName === entry.name) return;
          const parentPath = entry.relativePath.split("/").slice(0, -1).join("/");
          const newRelativePath = parentPath ? `${parentPath}/${newName}` : newName;
          await api.filesystem.rename({
            cwd,
            oldRelativePath: entry.relativePath,
            newRelativePath,
          });
          break;
        }
        case "delete": {
          const confirmed = window.confirm(`Delete ${entry.relativePath}?`);
          if (!confirmed) return;
          await api.filesystem.delete({ cwd, relativePath: entry.relativePath });
          break;
        }
        case "copyPath": {
          await navigator.clipboard.writeText(entry.relativePath);
          break;
        }
        case "mentionInChat": {
          composerHandleRef?.current?.insertTextAtCursor(` @${entry.relativePath} `);
          break;
        }
      }
    },
    [environmentId, cwd],
  );

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
      <FileTreeContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(null)}
        onAction={handleContextAction}
      />
    </Group>
  );
}
