import { ChevronRightIcon, WrapTextIcon } from "lucide-react";
import { useMemo } from "react";

interface EditorBreadcrumbProps {
  relativePath: string;
  wordWrap: boolean;
  onToggleWordWrap: () => void;
}

interface BreadcrumbSegment {
  readonly name: string;
  readonly cumulativePath: string;
  readonly isLast: boolean;
  readonly isFirst: boolean;
}

export function EditorBreadcrumb({
  relativePath,
  wordWrap,
  onToggleWordWrap,
}: EditorBreadcrumbProps) {
  const segments = useMemo((): BreadcrumbSegment[] => {
    const parts = relativePath.split("/");
    let cumulative = "";
    return parts.map((part, idx) => {
      cumulative = cumulative ? `${cumulative}/${part}` : part;
      return {
        name: part,
        cumulativePath: cumulative,
        isLast: idx === parts.length - 1,
        isFirst: idx === 0,
      };
    });
  }, [relativePath]);

  return (
    <div className="flex items-center gap-0.5 border-b border-white/5 px-3 py-1 text-xs text-muted-foreground overflow-x-auto">
      <div className="flex flex-1 items-center gap-0.5 overflow-x-auto">
        {segments.map((segment) => (
          <span key={segment.cumulativePath} className="flex items-center gap-0.5 shrink-0">
            {!segment.isFirst && <ChevronRightIcon className="size-3" />}
            <span className={segment.isLast ? "text-foreground" : ""}>{segment.name}</span>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onToggleWordWrap}
        title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
        className={`ml-2 shrink-0 rounded p-0.5 transition-colors ${
          wordWrap
            ? "text-foreground bg-white/10"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
        }`}
      >
        <WrapTextIcon className="size-3.5" />
      </button>
    </div>
  );
}
