import { useEffect, useRef, useState } from "react";
import type { EnvironmentId } from "@t3tools/contracts";
import { Compartment, StateEffect, type Extension } from "@codemirror/state";
import { readEnvironmentApi } from "../../environmentApi";
import { useComposerHandleContext } from "../../composerHandleContext";
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
  const wordWrapCompartmentRef = useRef(new Compartment());
  const [wordWrap, setWordWrap] = useState(true);
  const [cmModules, setCmModules] = useState<{
    EditorView: typeof import("@codemirror/view").EditorView;
    EditorState: typeof import("@codemirror/state").EditorState;
    basicSetup: Extension;
    oneDark: Extension;
    keymap: typeof import("@codemirror/view").keymap;
  } | null>(null);

  const { tabs, activeIndex, activeTab, openTab, closeTab, setActiveIndex, markDirty, markSaved } =
    useEditorTabs();

  const composerHandleRef = useComposerHandleContext();

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

  // Track tabs in a ref so the file-load effect doesn't depend on the tabs array
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // Load file content when activeFilePath changes
  useEffect(() => {
    if (!activeFilePath) return;

    const currentTabs = tabsRef.current;
    const existingIndex = currentTabs.findIndex((t) => t.relativePath === activeFilePath);
    if (existingIndex >= 0) {
      setActiveIndex(existingIndex);
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
  }, [activeFilePath, environmentId, cwd, openTab, setActiveIndex]);

  // Create/update EditorView when active tab changes
  useEffect(() => {
    if (!cmModules || !editorContainerRef.current || !activeTab) return;

    const { EditorView, EditorState, basicSetup, oneDark, keymap } = cmModules;
    const container = editorContainerRef.current;
    const currentTabPath = activeTab.relativePath;
    const compartment = wordWrapCompartmentRef.current;

    // Destroy previous view
    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }

    const extensions: Extension[] = [
      basicSetup,
      oneDark,
      compartment.of(wordWrap ? EditorView.lineWrapping : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          markDirty(currentTabPath, update.state.doc.toString());
        }
      }),
      keymap.of([
        {
          key: "Mod-s",
          run: (view) => {
            // Read content directly from the view to avoid stale closures
            const content = view.state.doc.toString();
            const api = readEnvironmentApi(environmentId);
            if (api) {
              void api.projects
                .writeFile({ cwd, relativePath: currentTabPath, contents: content })
                .then(() => markSaved(currentTabPath, content))
                .catch(() => {
                  // TODO: toast error
                });
            }
            return true;
          },
        },
      ]),
      EditorView.theme({
        "&": { height: "100%", fontSize: "13px" },
        ".cm-scroller": { overflow: "auto" },
      }),
      EditorView.domEventHandlers({
        contextmenu: (event, view) => {
          const sel = view.state.selection.main;
          if (sel.empty) return false;
          event.preventDefault();
          const startLine = view.state.doc.lineAt(sel.from).number;
          const endLine = view.state.doc.lineAt(sel.to).number;

          // Create a simple context menu
          const menu = document.createElement("div");
          menu.className =
            "fixed z-50 min-w-[180px] rounded-md border border-border bg-popover py-1 shadow-md";
          menu.style.left = `${event.clientX}px`;
          menu.style.top = `${event.clientY}px`;

          const btn = document.createElement("button");
          btn.className =
            "flex w-full items-center px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent hover:text-accent-foreground";
          btn.textContent = "Mention Selection in Chat";
          btn.onclick = () => {
            composerHandleRef?.current?.insertTextAtCursor(
              ` @${currentTabPath}:L${startLine}-L${endLine} `,
            );
            menu.remove();
          };
          menu.appendChild(btn);
          document.body.appendChild(menu);

          const dismiss = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
              menu.remove();
              document.removeEventListener("mousedown", dismiss);
            }
          };
          const dismissOnEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
              menu.remove();
              document.removeEventListener("keydown", dismissOnEsc);
            }
          };
          document.addEventListener("mousedown", dismiss);
          document.addEventListener("keydown", dismissOnEsc);
          return true;
        },
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

  // Toggle word wrap dynamically without recreating the editor
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view || !cmModules) return;
    const compartment = wordWrapCompartmentRef.current;
    view.dispatch({
      effects: compartment.reconfigure(wordWrap ? cmModules.EditorView.lineWrapping : []),
    });
  }, [wordWrap, cmModules]);

  if (!activeTab) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-white/[0.02] text-sm text-muted-foreground">
        Select a file to view
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white/[0.02]">
      <EditorTabs
        tabs={tabs}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        onClose={closeTab}
      />
      {activeTab && (
        <EditorBreadcrumb
          relativePath={activeTab.relativePath}
          wordWrap={wordWrap}
          onToggleWordWrap={() => setWordWrap((prev) => !prev)}
        />
      )}
      <div ref={editorContainerRef} className="flex-1 min-h-0 overflow-hidden" />
    </div>
  );
}
