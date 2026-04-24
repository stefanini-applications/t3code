import { useRef, useEffect } from "react";
import type { DirectoryEntry } from "@t3tools/contracts";

export type TreeContextAction =
  | "newFile"
  | "newFolder"
  | "rename"
  | "delete"
  | "copyPath"
  | "mentionInChat";

interface ContextMenuState {
  x: number;
  y: number;
  entry: DirectoryEntry;
}

interface FileTreeContextMenuProps {
  state: ContextMenuState | null;
  onClose: () => void;
  onAction: (action: TreeContextAction, entry: DirectoryEntry) => void;
}

const MENU_ITEMS: { action: TreeContextAction; label: string; dirOnly?: boolean }[] = [
  { action: "newFile", label: "New File", dirOnly: true },
  { action: "newFolder", label: "New Folder", dirOnly: true },
  { action: "rename", label: "Rename" },
  { action: "delete", label: "Delete" },
  { action: "copyPath", label: "Copy Path" },
  { action: "mentionInChat", label: "Mention in Chat" },
];

export function FileTreeContextMenu({ state, onClose, onAction }: FileTreeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  const isDir = state.entry.kind === "directory";
  const items = MENU_ITEMS.filter((item) => !item.dirOnly || isDir);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-md"
      style={{ left: state.x, top: state.y }}
    >
      {items.map((item) => (
        <button
          key={item.action}
          type="button"
          className="flex w-full items-center px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => {
            onAction(item.action, state.entry);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
