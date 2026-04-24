import { useCallback, useEffect, useRef } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view when it changes
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex]);

  // Horizontal scroll with mouse wheel (shift not required)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const container = scrollRef.current;
    if (!container) return;
    // Scroll horizontally whether the wheel is vertical or horizontal
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    container.scrollLeft += delta;
    e.preventDefault();
  }, []);

  if (tabs.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      className="editor-tabs-scroll flex h-8 shrink-0 items-center overflow-x-auto border-b border-white/5"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.relativePath}
          ref={index === activeIndex ? activeTabRef : undefined}
          type="button"
          onClick={() => onSelect(index)}
          onAuxClick={(e) => {
            // Middle-click (button 1) closes the tab
            if (e.button === 1) {
              e.preventDefault();
              onClose(index);
            }
          }}
          className={`group flex items-center gap-1.5 px-3 h-full text-xs border-r border-white/5 shrink-0 ${
            index === activeIndex
              ? "bg-white/5 text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
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
            className="size-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-white/10"
          >
            <XIcon className="size-3" />
          </span>
        </button>
      ))}
    </div>
  );
}
