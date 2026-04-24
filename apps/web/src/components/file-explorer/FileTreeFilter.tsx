import { SearchIcon, XIcon } from "lucide-react";
import { useCallback, useRef } from "react";

interface FileTreeFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function FileTreeFilter({ value, onChange }: FileTreeFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div className="border-b border-border px-2 py-1.5">
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
        <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Filter files..."
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}
