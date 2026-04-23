import { useEffect, useRef, useState } from "react";
import type { EnvironmentId } from "@t3tools/contracts";
import { StateEffect, type Extension } from "@codemirror/state";
import { readEnvironmentApi } from "../../environmentApi";
import { useEditorTabs } from "./useEditorTabs";
import { EditorTabs } from "./EditorTabs";
import { EditorBreadcrumb } from "./EditorBreadcrumb";
import { getLanguageExtension } from "./languageExtensions";

interface CodeEditorProps {
  environmentId: EnvironmentId;
  cwd: string;
  activeFilePath: string | null;
  /** Reserved for future use (e.g. "go to definition") */
  onOpenFile: (relativePath: string) => void;
}

export function CodeEditor({ environmentId, cwd, activeFilePath }: CodeEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<import("@codemirror/view").EditorView | null>(null);
  const [cmModules, setCmModules] = useState<{
    EditorView: typeof import("@codemirror/view").EditorView;
    EditorState: typeof import("@codemirror/state").EditorState;
    basicSetup: Extension;
    oneDark: Extension;
    keymap: typeof import("@codemirror/view").keymap;
  } | null>(null);

  const { tabs, activeIndex, activeTab, openTab, closeTab, setActiveIndex, markDirty, markSaved } =
    useEditorTabs();

  // Lazy-load CodeMirror on first mount
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      import("@codemirror/view"),
      import("@codemirror/state"),
      import("codemirror"),
      import("@codemirror/theme-one-dark"),
    ]).then(([viewMod, stateMod, cmMod, themeMod]) => {
      if (cancelled) return;
      setCmModules({
        EditorView: viewMod.EditorView,
        EditorState: stateMod.EditorState,
        basicSetup: cmMod.basicSetup,
        oneDark: themeMod.oneDark,
        keymap: viewMod.keymap,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load file content when activeFilePath changes
  useEffect(() => {
    if (!activeFilePath) return;

    const existingTab = tabs.find((t) => t.relativePath === activeFilePath);
    if (existingTab) {
      const idx = tabs.indexOf(existingTab);
      setActiveIndex(idx);
      return;
    }

    const api = readEnvironmentApi(environmentId);
    if (!api) return;

    let cancelled = false;
    void api.filesystem.readFile({ cwd, relativePath: activeFilePath }).then((result) => {
      if (cancelled) return;
      if (result.encoding === "utf-8") {
        openTab(activeFilePath, result.content);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeFilePath, environmentId, cwd, openTab, setActiveIndex, tabs]);

  // Create/update EditorView when active tab changes
  useEffect(() => {
    if (!cmModules || !editorContainerRef.current || !activeTab) return;

    const { EditorView, EditorState, basicSetup, oneDark, keymap } = cmModules;
    const container = editorContainerRef.current;
    const currentTabPath = activeTab.relativePath;
    const currentTabContent = activeTab.currentContent;

    // Save handler
    const saveFile = async () => {
      const api = readEnvironmentApi(environmentId);
      if (!api) return;
      try {
        await api.projects.writeFile({
          cwd,
          relativePath: currentTabPath,
          contents: currentTabContent,
        });
        markSaved(currentTabPath, currentTabContent);
      } catch {
        // TODO: toast error
      }
    };

    // Destroy previous view
    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }

    const extensions: Extension[] = [
      basicSetup,
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          markDirty(currentTabPath, update.state.doc.toString());
        }
      }),
      keymap.of([
        {
          key: "Mod-s",
          run: () => {
            void saveFile();
            return true;
          },
        },
      ]),
      EditorView.theme({
        "&": { height: "100%", fontSize: "13px" },
        ".cm-scroller": { overflow: "auto" },
      }),
    ];

    const state = EditorState.create({
      doc: activeTab.originalContent,
      extensions,
    });

    const view = new EditorView({ state, parent: container });
    editorViewRef.current = view;

    // Load language extension async
    const langLoader = getLanguageExtension(currentTabPath);
    if (langLoader) {
      void langLoader().then((langExt) => {
        if (editorViewRef.current === view) {
          view.dispatch({
            effects: StateEffect.appendConfig.of(langExt),
          });
        }
      });
    }

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
    // Only re-create editor when the tab identity changes or CM modules load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmModules, activeTab?.relativePath, activeTab?.originalContent]);

  if (!activeTab) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-sm text-muted-foreground">
        Select a file to view
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <EditorTabs
        tabs={tabs}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        onClose={closeTab}
      />
      {activeTab && <EditorBreadcrumb relativePath={activeTab.relativePath} />}
      <div ref={editorContainerRef} className="flex-1 min-h-0 overflow-hidden" />
    </div>
  );
}
