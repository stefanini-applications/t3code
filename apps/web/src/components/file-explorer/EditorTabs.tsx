import { XIcon } from "lucide-react";
import type { EditorTab } from "./useEditorTabs";
import { basenameOfPath } from "../../vscode-icons";

interface EditorTabsProps {
  tabs: readonly EditorTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: (index: number) => void;
}

export function EditorTabs({ tabs, activeIndex, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex h-8 shrink-0 items-center overflow-x-auto border-b border-border bg-card">
      {tabs.map((tab, index) => (
        <button
          key={tab.relativePath}
          type="button"
          onClick={() => onSelect(index)}
          className={`group flex items-center gap-1.5 px-3 h-full text-xs border-r border-border shrink-0 ${
            index === activeIndex
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
          }`}
        >
          <span className="truncate max-w-[120px]">
            {tab.isDirty && <span className="text-yellow-500 mr-0.5">&bull;</span>}
            {basenameOfPath(tab.relativePath)}
          </span>
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onClose(index);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onClose(index);
              }
            }}
            className="size-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-accent"
          >
            <XIcon className="size-3" />
          </span>
        </button>
      ))}
    </div>
  );
}
