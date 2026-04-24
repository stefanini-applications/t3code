import { useCallback, type ReactNode } from "react";
import { Sidebar, SidebarProvider, SidebarRail } from "~/components/ui/sidebar";
import type { PanelTab } from "../panelRouteSearch";
import { RightPanelTabBar } from "./RightPanelTabBar";

const SIDEBAR_WIDTH_STORAGE_KEY = "chat_right_panel_width";

const DEFAULT_WIDTH_BY_TAB: Record<PanelTab, string> = {
  files: "clamp(36rem,52vw,56rem)",
  diff: "clamp(28rem,48vw,44rem)",
};

const MIN_WIDTH_BY_TAB: Record<PanelTab, number> = {
  files: 36 * 16,
  diff: 26 * 16,
};

const COMPOSER_COMPACT_MIN_LEFT_CONTROLS_WIDTH_PX = 208;

interface RightPanelProps {
  activeTab: PanelTab;
  open: boolean;
  onTabChange: (tab: PanelTab) => void;
  onClose: () => void;
  onOpen: () => void;
  children: ReactNode;
}

export function RightPanel({
  activeTab,
  open,
  onTabChange,
  onClose,
  onOpen,
  children,
}: RightPanelProps) {
  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpen();
        return;
      }
      onClose();
    },
    [onClose, onOpen],
  );

  const shouldAcceptWidth = useCallback(
    ({ nextWidth, wrapper }: { nextWidth: number; wrapper: HTMLElement }) => {
      const composerForm = document.querySelector<HTMLElement>("[data-chat-composer-form='true']");
      if (!composerForm) return true;
      const composerViewport = composerForm.parentElement;
      if (!composerViewport) return true;
      const previousSidebarWidth = wrapper.style.getPropertyValue("--sidebar-width");
      wrapper.style.setProperty("--sidebar-width", `${nextWidth}px`);

      const viewportStyle = window.getComputedStyle(composerViewport);
      const viewportPaddingLeft = Number.parseFloat(viewportStyle.paddingLeft) || 0;
      const viewportPaddingRight = Number.parseFloat(viewportStyle.paddingRight) || 0;
      const viewportContentWidth = Math.max(
        0,
        composerViewport.clientWidth - viewportPaddingLeft - viewportPaddingRight,
      );
      const formRect = composerForm.getBoundingClientRect();
      const composerFooter = composerForm.querySelector<HTMLElement>(
        "[data-chat-composer-footer='true']",
      );
      const composerRightActions = composerForm.querySelector<HTMLElement>(
        "[data-chat-composer-actions='right']",
      );
      const composerRightActionsWidth = composerRightActions?.getBoundingClientRect().width ?? 0;
      const composerFooterGap = composerFooter
        ? Number.parseFloat(window.getComputedStyle(composerFooter).columnGap) ||
          Number.parseFloat(window.getComputedStyle(composerFooter).gap) ||
          0
        : 0;
      const minimumComposerWidth =
        COMPOSER_COMPACT_MIN_LEFT_CONTROLS_WIDTH_PX + composerRightActionsWidth + composerFooterGap;
      const hasComposerOverflow = composerForm.scrollWidth > composerForm.clientWidth + 0.5;
      const overflowsViewport = formRect.width > viewportContentWidth + 0.5;
      const violatesMinimumComposerWidth = composerForm.clientWidth + 0.5 < minimumComposerWidth;

      if (previousSidebarWidth.length > 0) {
        wrapper.style.setProperty("--sidebar-width", previousSidebarWidth);
      } else {
        wrapper.style.removeProperty("--sidebar-width");
      }

      return !hasComposerOverflow && !overflowsViewport && !violatesMinimumComposerWidth;
    },
    [],
  );

  return (
    <SidebarProvider
      defaultOpen={false}
      open={open}
      onOpenChange={onOpenChange}
      className="w-auto min-h-0 flex-none bg-transparent"
      style={{ "--sidebar-width": DEFAULT_WIDTH_BY_TAB[activeTab] } as React.CSSProperties}
    >
      <Sidebar
        side="right"
        collapsible="offcanvas"
        className="border-l border-border bg-card text-foreground"
        resizable={{
          minWidth: MIN_WIDTH_BY_TAB[activeTab],
          shouldAcceptWidth,
          storageKey: SIDEBAR_WIDTH_STORAGE_KEY,
        }}
      >
        <RightPanelTabBar activeTab={activeTab} onTabChange={onTabChange} />
        {children}
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}
