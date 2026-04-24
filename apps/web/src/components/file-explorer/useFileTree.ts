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

export type RootLoadState = "idle" | "loading" | "loaded" | "error";

export function useFileTree({ environmentId, cwd }: UseFileTreeOptions) {
  const [expandedDirs, setExpandedDirs] = useState<ReadonlyMap<string, ExpandedDir>>(new Map());
  const [rootEntries, setRootEntries] = useState<readonly DirectoryEntry[] | null>(null);
  const [rootLoadState, setRootLoadState] = useState<RootLoadState>("idle");
  const [rootError, setRootError] = useState<string | null>(null);
  const loadedRef = useRef(new Set<string>());

  const loadDirectory = useCallback(
    async (relativePath: string) => {
      const api = readEnvironmentApi(environmentId);
      if (!api) {
        if (relativePath === ".") {
          setRootLoadState("error");
          setRootError("Environment not connected");
        }
        return;
      }

      if (relativePath === ".") {
        setRootLoadState("loading");
        setRootError(null);
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
          setRootLoadState("loaded");
        } else {
          setExpandedDirs((prev) => {
            const next = new Map(prev);
            next.set(relativePath, { entries: result.entries, isLoading: false });
            return next;
          });
        }
        loadedRef.current.add(relativePath);
      } catch (err) {
        if (relativePath === ".") {
          setRootLoadState("error");
          setRootError(err instanceof Error ? err.message : "Failed to list directory");
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
      // Collapse: if currently expanded, just remove from map and return
      setExpandedDirs((prev) => {
        if (prev.has(relativePath)) {
          const next = new Map(prev);
          next.delete(relativePath);
          return next;
        }

        // Expand: if already loaded before, restore with a re-fetch
        if (loadedRef.current.has(relativePath)) {
          void loadDirectory(relativePath);
          return prev;
        }

        // Never loaded: trigger the first load
        void loadDirectory(relativePath);
        return prev;
      });
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
    rootLoadState,
    rootError,
    expandedDirs,
    loadRoot,
    toggleExpand,
    expandDir,
    collapseDir,
  };
}
