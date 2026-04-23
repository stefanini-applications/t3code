import { ChevronRightIcon } from "lucide-react";
import { useMemo } from "react";

interface EditorBreadcrumbProps {
  relativePath: string;
}

interface BreadcrumbSegment {
  readonly name: string;
  readonly cumulativePath: string;
  readonly isLast: boolean;
  readonly isFirst: boolean;
}

export function EditorBreadcrumb({ relativePath }: EditorBreadcrumbProps) {
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
    <div className="flex items-center gap-0.5 px-3 py-1 text-xs text-muted-foreground border-b border-border bg-card overflow-x-auto">
      {segments.map((segment) => (
        <span key={segment.cumulativePath} className="flex items-center gap-0.5 shrink-0">
          {!segment.isFirst && <ChevronRightIcon className="size-3" />}
          <span className={segment.isLast ? "text-foreground" : ""}>{segment.name}</span>
        </span>
      ))}
    </div>
  );
}
