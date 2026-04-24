import { useCallback, useState } from "react";

const MAX_TABS = 10;

export interface EditorTab {
  readonly relativePath: string;
  readonly isDirty: boolean;
  readonly originalContent: string;
  readonly currentContent: string;
}

interface EditorTabsState {
  readonly tabs: readonly EditorTab[];
  readonly activeIndex: number;
}

export function useEditorTabs() {
  const [state, setState] = useState<EditorTabsState>({
    tabs: [],
    activeIndex: -1,
  });

  const activeTab = state.activeIndex >= 0 ? (state.tabs[state.activeIndex] ?? null) : null;

  const openTab = useCallback((relativePath: string, content: string) => {
    setState((prev) => {
      const existingIndex = prev.tabs.findIndex((t) => t.relativePath === relativePath);
      if (existingIndex >= 0) {
        return { ...prev, activeIndex: existingIndex };
      }

      let tabs = [...prev.tabs];

      // LRU eviction if at max capacity
      if (tabs.length >= MAX_TABS) {
        let evictIndex = -1;
        for (let i = 0; i < tabs.length; i++) {
          if (i !== prev.activeIndex && !tabs[i]!.isDirty) {
            evictIndex = i;
            break;
          }
        }
        if (evictIndex >= 0) {
          tabs.splice(evictIndex, 1);
        } else {
          return prev;
        }
      }

      const newTab: EditorTab = {
        relativePath,
        isDirty: false,
        originalContent: content,
        currentContent: content,
      };

      tabs = [...tabs, newTab];
      return { tabs, activeIndex: tabs.length - 1 };
    });
  }, []);

  const closeTab = useCallback((index: number) => {
    setState((prev) => {
      const tab = prev.tabs[index];
      if (!tab) return prev;

      if (tab.isDirty) {
        const confirmed = window.confirm(`${tab.relativePath} has unsaved changes. Close anyway?`);
        if (!confirmed) return prev;
      }

      const tabs = prev.tabs.filter((_, i) => i !== index);
      let activeIndex = prev.activeIndex;
      if (activeIndex >= tabs.length) {
        activeIndex = tabs.length - 1;
      } else if (index < activeIndex) {
        activeIndex -= 1;
      }

      return { tabs, activeIndex };
    });
  }, []);

  const setActiveIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, activeIndex: index }));
  }, []);

  const markDirty = useCallback((relativePath: string, content: string) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) =>
        t.relativePath === relativePath
          ? { ...t, currentContent: content, isDirty: content !== t.originalContent }
          : t,
      ),
    }));
  }, []);

  const markSaved = useCallback((relativePath: string, savedContent: string) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) =>
        t.relativePath === relativePath
          ? { ...t, originalContent: savedContent, currentContent: savedContent, isDirty: false }
          : t,
      ),
    }));
  }, []);

  return {
    tabs: state.tabs,
    activeIndex: state.activeIndex,
    activeTab,
    openTab,
    closeTab,
    setActiveIndex,
    markDirty,
    markSaved,
  };
}
