import { TurnId } from "@t3tools/contracts";

export type PanelTab = "files" | "diff";

export interface PanelRouteSearch {
  panel?: PanelTab | undefined;
  diffTurnId?: TurnId | undefined;
  diffFilePath?: string | undefined;
  diffWorkingTree?: boolean | undefined;
}

function isPanelTabValue(value: unknown): value is PanelTab {
  return value === "files" || value === "diff";
}

function normalizeSearchString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function stripPanelSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "panel" | "diffTurnId" | "diffFilePath" | "diffWorkingTree"> {
  const {
    panel: _panel,
    diffTurnId: _diffTurnId,
    diffFilePath: _diffFilePath,
    diffWorkingTree: _diffWorkingTree,
    ...rest
  } = params;
  return rest as Omit<T, "panel" | "diffTurnId" | "diffFilePath" | "diffWorkingTree">;
}

/**
 * Backward-compatible parse: also accepts legacy `?diff=1` and normalizes to `panel=diff`.
 */
export function parsePanelRouteSearch(search: Record<string, unknown>): PanelRouteSearch {
  // Support new `?panel=files` / `?panel=diff`
  let panel: PanelTab | undefined;
  if (isPanelTabValue(search.panel)) {
    panel = search.panel;
  } else if (search.diff === "1" || search.diff === 1 || search.diff === true) {
    // Backward compat: legacy `?diff=1` → `panel=diff`
    panel = "diff";
  }

  const isDiff = panel === "diff";
  const diffWorkingTree =
    isDiff && (search.diffWorkingTree === true || search.diffWorkingTree === "1")
      ? true
      : undefined;
  const diffTurnIdRaw =
    isDiff && !diffWorkingTree ? normalizeSearchString(search.diffTurnId) : undefined;
  const diffTurnId = diffTurnIdRaw ? TurnId.make(diffTurnIdRaw) : undefined;
  const diffFilePath =
    isDiff && diffTurnId ? normalizeSearchString(search.diffFilePath) : undefined;

  return {
    ...(panel ? { panel } : {}),
    ...(diffWorkingTree ? { diffWorkingTree } : {}),
    ...(diffTurnId ? { diffTurnId } : {}),
    ...(diffFilePath ? { diffFilePath } : {}),
  };
}
