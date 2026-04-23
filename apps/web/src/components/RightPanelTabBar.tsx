import { FilesIcon, GitCompareArrowsIcon } from "lucide-react";
import type { PanelTab } from "../panelRouteSearch";

interface RightPanelTabBarProps {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
}

export function RightPanelTabBar({ activeTab, onTabChange }: RightPanelTabBarProps) {
  return (
    <div className="flex h-9 shrink-0 items-center border-b border-border bg-card px-2 gap-1">
      <button
        type="button"
        onClick={() => onTabChange("files")}
        className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
          activeTab === "files"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
      >
        <FilesIcon className="size-3.5" />
        Files
      </button>
      <button
        type="button"
        onClick={() => onTabChange("diff")}
        className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
          activeTab === "diff"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
      >
        <GitCompareArrowsIcon className="size-3.5" />
        Diff
      </button>
    </div>
  );
}
