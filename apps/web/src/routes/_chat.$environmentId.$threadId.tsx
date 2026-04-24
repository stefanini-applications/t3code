import { createFileRoute, retainSearchParams, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";

import ChatView from "../components/ChatView";
import { threadHasStarted } from "../components/ChatView.logic";
import { DiffWorkerPoolProvider } from "../components/DiffWorkerPoolProvider";
import {
  DiffPanelHeaderSkeleton,
  DiffPanelLoadingState,
  DiffPanelShell,
  type DiffPanelMode,
} from "../components/DiffPanelShell";
import { finalizePromotedDraftThreadByRef, useComposerDraftStore } from "../composerDraftStore";
import {
  type PanelRouteSearch,
  parsePanelRouteSearch,
  stripPanelSearchParams,
} from "../panelRouteSearch";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY } from "../rightPanelLayout";
import {
  selectEnvironmentState,
  selectProjectByRef,
  selectThreadExistsByRef,
  useStore,
} from "../store";
import { useTheme } from "../hooks/useTheme";
import { createThreadSelectorByRef } from "../storeSelectors";
import { resolveThreadRouteRef, buildThreadRouteParams } from "../threadRoutes";
import { RightPanel } from "../components/RightPanel";
import { RightPanelTabBar } from "../components/RightPanelTabBar";
import { RightPanelSheet } from "../components/RightPanelSheet";
import { SidebarInset } from "~/components/ui/sidebar";

const DiffPanel = lazy(() => import("../components/DiffPanel"));
const FileExplorer = lazy(() =>
  import("../components/file-explorer/FileExplorer").then((m) => ({ default: m.FileExplorer })),
);

const DiffLoadingFallback = (props: { mode: DiffPanelMode }) => {
  return (
    <DiffPanelShell mode={props.mode} header={<DiffPanelHeaderSkeleton />}>
      <DiffPanelLoadingState label="Loading diff viewer..." />
    </DiffPanelShell>
  );
};

const LazyDiffPanel = (props: { mode: DiffPanelMode }) => {
  return (
    <DiffWorkerPoolProvider>
      <Suspense fallback={<DiffLoadingFallback mode={props.mode} />}>
        <DiffPanel mode={props.mode} />
      </Suspense>
    </DiffWorkerPoolProvider>
  );
};

function ChatThreadRouteView() {
  const navigate = useNavigate();
  const threadRef = Route.useParams({
    select: (params) => resolveThreadRouteRef(params),
  });
  const search = Route.useSearch();
  const bootstrapComplete = useStore(
    (store) => selectEnvironmentState(store, threadRef?.environmentId ?? null).bootstrapComplete,
  );
  const serverThread = useStore(useMemo(() => createThreadSelectorByRef(threadRef), [threadRef]));
  const threadExists = useStore((store) => selectThreadExistsByRef(store, threadRef));
  const environmentHasServerThreads = useStore(
    (store) => selectEnvironmentState(store, threadRef?.environmentId ?? null).threadIds.length > 0,
  );
  const draftThreadExists = useComposerDraftStore((store) =>
    threadRef ? store.getDraftThreadByRef(threadRef) !== null : false,
  );
  const draftThread = useComposerDraftStore((store) =>
    threadRef ? store.getDraftThreadByRef(threadRef) : null,
  );
  const environmentHasDraftThreads = useComposerDraftStore((store) => {
    if (!threadRef) {
      return false;
    }
    return store.hasDraftThreadsInEnvironment(threadRef.environmentId);
  });
  const routeThreadExists = threadExists || draftThreadExists;
  const serverThreadStarted = threadHasStarted(serverThread);
  const activeProject = useStore((store) => {
    if (!serverThread?.projectId || !threadRef) return undefined;
    return selectProjectByRef(store, {
      environmentId: threadRef.environmentId,
      projectId: serverThread.projectId,
    });
  });
  const activeCwd = serverThread?.worktreePath ?? activeProject?.cwd ?? null;
  const { resolvedTheme } = useTheme();
  const environmentHasAnyThreads = environmentHasServerThreads || environmentHasDraftThreads;
  const panelTab = search.panel;
  const diffOpen = panelTab === "diff";
  const panelOpen = panelTab !== undefined;
  const shouldUseDiffSheet = useMediaQuery(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY);
  const currentThreadKey = threadRef ? `${threadRef.environmentId}:${threadRef.threadId}` : null;
  const [panelMountState, setPanelMountState] = useState(() => ({
    threadKey: currentThreadKey,
    hasOpenedPanel: panelOpen,
  }));
  const hasOpenedPanel =
    panelMountState.threadKey === currentThreadKey ? panelMountState.hasOpenedPanel : panelOpen;
  const markPanelOpened = useCallback(() => {
    setPanelMountState((previous) => {
      if (previous.threadKey === currentThreadKey && previous.hasOpenedPanel) {
        return previous;
      }
      return {
        threadKey: currentThreadKey,
        hasOpenedPanel: true,
      };
    });
  }, [currentThreadKey]);
  const closePanel = useCallback(() => {
    if (!threadRef) {
      return;
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
      search: { panel: undefined },
    });
  }, [navigate, threadRef]);
  const openDiff = useCallback(() => {
    if (!threadRef) {
      return;
    }
    markPanelOpened();
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
      search: (previous) => {
        const rest = stripPanelSearchParams(previous);
        return { ...rest, panel: "diff" as const };
      },
    });
  }, [markPanelOpened, navigate, threadRef]);

  useEffect(() => {
    if (!threadRef || !bootstrapComplete) {
      return;
    }

    if (!routeThreadExists && environmentHasAnyThreads) {
      void navigate({ to: "/", replace: true });
    }
  }, [bootstrapComplete, environmentHasAnyThreads, navigate, routeThreadExists, threadRef]);

  useEffect(() => {
    if (!threadRef || !serverThreadStarted || !draftThread?.promotedTo) {
      return;
    }
    finalizePromotedDraftThreadByRef(threadRef);
  }, [draftThread?.promotedTo, serverThreadStarted, threadRef]);

  if (!threadRef || !bootstrapComplete || !routeThreadExists) {
    return null;
  }

  const shouldRenderDiffContent = diffOpen || hasOpenedPanel;

  if (!shouldUseDiffSheet) {
    return (
      <>
        <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
          <ChatView
            environmentId={threadRef.environmentId}
            threadId={threadRef.threadId}
            onDiffPanelOpen={markPanelOpened}
            reserveTitleBarControlInset={!panelOpen}
            routeKind="server"
          />
        </SidebarInset>
        <RightPanel
          activeTab={panelTab ?? "diff"}
          open={panelOpen}
          onTabChange={(tab) => {
            if (tab === "diff") {
              markPanelOpened();
            }
            void navigate({
              to: "/$environmentId/$threadId",
              params: buildThreadRouteParams(threadRef),
              search: (prev) => ({ ...stripPanelSearchParams(prev), panel: tab }),
            });
          }}
          onClose={closePanel}
          onOpen={openDiff}
        >
          <div
            className="flex min-h-0 w-full flex-1 flex-col"
            style={{ display: panelTab === "diff" ? "flex" : "none" }}
          >
            {shouldRenderDiffContent ? <LazyDiffPanel mode="sidebar" /> : null}
          </div>
          <div
            className="flex min-h-0 w-full flex-1 flex-col"
            style={{ display: panelTab === "files" ? "flex" : "none" }}
          >
            {activeCwd ? (
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                    Loading file explorer...
                  </div>
                }
              >
                <FileExplorer
                  environmentId={threadRef.environmentId}
                  cwd={activeCwd}
                  theme={(resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark"}
                />
              </Suspense>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                No workspace available
              </div>
            )}
          </div>
        </RightPanel>
      </>
    );
  }

  return (
    <>
      <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <ChatView
          environmentId={threadRef.environmentId}
          threadId={threadRef.threadId}
          onDiffPanelOpen={markPanelOpened}
          routeKind="server"
        />
      </SidebarInset>
      <RightPanelSheet open={panelOpen} onClose={closePanel}>
        <RightPanelTabBar
          activeTab={panelTab ?? "diff"}
          onTabChange={(tab) => {
            if (tab === "diff") markPanelOpened();
            void navigate({
              to: "/$environmentId/$threadId",
              params: buildThreadRouteParams(threadRef),
              search: (prev) => ({ ...stripPanelSearchParams(prev), panel: tab }),
            });
          }}
        />
        <div
          className="flex min-h-0 w-full flex-1 flex-col"
          style={{ display: panelTab === "diff" ? "flex" : "none" }}
        >
          {shouldRenderDiffContent ? <LazyDiffPanel mode="sheet" /> : null}
        </div>
        <div
          className="flex min-h-0 w-full flex-1 flex-col"
          style={{ display: panelTab === "files" ? "flex" : "none" }}
        >
          {activeCwd ? (
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                  Loading file explorer...
                </div>
              }
            >
              <FileExplorer
                environmentId={threadRef.environmentId}
                cwd={activeCwd}
                theme={(resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark"}
              />
            </Suspense>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              No workspace available
            </div>
          )}
        </div>
      </RightPanelSheet>
    </>
  );
}

export const Route = createFileRoute("/_chat/$environmentId/$threadId")({
  validateSearch: (search) => parsePanelRouteSearch(search),
  search: {
    middlewares: [retainSearchParams<PanelRouteSearch>(["panel"])],
  },
  component: ChatThreadRouteView,
});
