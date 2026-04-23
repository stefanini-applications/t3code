import { useCallback, useRef, useState } from "react";
import type {
  DirectoryEntry,
  EnvironmentId,
  FilesystemListDirectoryResult,
} from "@t3tools/contracts";
import { readEnvironmentApi } from "../../environmentApi";

interface UseFileTreeOptions {
  environmentId: EnvironmentId;
  cwd: string;
}

interface ExpandedDir {
  entries: readonly DirectoryEntry[];
  isLoading: boolean;
}

export function useFileTree({ environmentId, cwd }: UseFileTreeOptions) {
  const [expandedDirs, setExpandedDirs] = useState<ReadonlyMap<string, ExpandedDir>>(new Map());
  const [rootEntries, setRootEntries] = useState<readonly DirectoryEntry[] | null>(null);
  const [rootLoading, setRootLoading] = useState(false);
  const loadedRef = useRef(new Set<string>());

  const loadDirectory = useCallback(
    async (relativePath: string) => {
      const api = readEnvironmentApi(environmentId);
      if (!api) return;

      if (relativePath === ".") {
        setRootLoading(true);
      } else {
        setExpandedDirs((prev) => {
          const next = new Map(prev);
          next.set(relativePath, {
            entries: prev.get(relativePath)?.entries ?? [],
            isLoading: true,
          });
          return next;
        });
      }

      try {
        const result: FilesystemListDirectoryResult = await api.filesystem.listDirectory({
          cwd,
          relativePath,
        });

        if (relativePath === ".") {
          setRootEntries(result.entries);
          setRootLoading(false);
        } else {
          setExpandedDirs((prev) => {
            const next = new Map(prev);
            next.set(relativePath, { entries: result.entries, isLoading: false });
            return next;
          });
        }
        loadedRef.current.add(relativePath);
      } catch {
        if (relativePath === ".") {
          setRootLoading(false);
        } else {
          setExpandedDirs((prev) => {
            const next = new Map(prev);
            next.set(relativePath, { entries: [], isLoading: false });
            return next;
          });
        }
      }
    },
    [environmentId, cwd],
  );

  const toggleExpand = useCallback(
    (relativePath: string) => {
      setExpandedDirs((prev) => {
        if (prev.has(relativePath)) {
          const next = new Map(prev);
          next.delete(relativePath);
          return next;
        }
        return prev;
      });

      // If not loaded yet, load it
      if (!loadedRef.current.has(relativePath)) {
        void loadDirectory(relativePath);
      } else {
        // Re-expand: just put it back
        setExpandedDirs((prev) => {
          if (prev.has(relativePath)) return prev;
          // Re-load to get fresh data
          void loadDirectory(relativePath);
          return prev;
        });
      }
    },
    [loadDirectory],
  );

  const collapseDir = useCallback((relativePath: string) => {
    setExpandedDirs((prev) => {
      if (!prev.has(relativePath)) return prev;
      const next = new Map(prev);
      next.delete(relativePath);
      return next;
    });
  }, []);

  const expandDir = useCallback(
    (relativePath: string) => {
      if (!loadedRef.current.has(relativePath)) {
        void loadDirectory(relativePath);
      } else {
        setExpandedDirs((prev) => {
          if (prev.has(relativePath)) return prev;
          void loadDirectory(relativePath);
          return prev;
        });
      }
    },
    [loadDirectory],
  );

  const loadRoot = useCallback(() => {
    void loadDirectory(".");
  }, [loadDirectory]);

  return {
    rootEntries,
    rootLoading,
    expandedDirs,
    loadRoot,
    toggleExpand,
    expandDir,
    collapseDir,
  };
}
