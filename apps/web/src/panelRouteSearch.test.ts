import { describe, expect, it } from "vitest";
import { parsePanelRouteSearch, stripPanelSearchParams } from "./panelRouteSearch";

describe("parsePanelRouteSearch", () => {
  it("parses panel=files", () => {
    expect(parsePanelRouteSearch({ panel: "files" })).toEqual({ panel: "files" });
  });

  it("parses panel=diff", () => {
    expect(parsePanelRouteSearch({ panel: "diff" })).toEqual({ panel: "diff" });
  });

  it("returns empty for no panel", () => {
    expect(parsePanelRouteSearch({})).toEqual({});
  });

  it("backward compat: diff=1 → panel=diff", () => {
    expect(parsePanelRouteSearch({ diff: "1" })).toEqual({ panel: "diff" });
  });

  it("preserves diffTurnId when panel=diff", () => {
    const result = parsePanelRouteSearch({ panel: "diff", diffTurnId: "turn-1" });
    expect(result.panel).toBe("diff");
    expect(result.diffTurnId).toBeDefined();
  });

  it("ignores diffTurnId when panel=files", () => {
    const result = parsePanelRouteSearch({ panel: "files", diffTurnId: "turn-1" });
    expect(result.diffTurnId).toBeUndefined();
  });

  it("rejects invalid panel values", () => {
    expect(parsePanelRouteSearch({ panel: "invalid" })).toEqual({});
  });
});

describe("stripPanelSearchParams", () => {
  it("removes panel-related keys", () => {
    const result = stripPanelSearchParams({
      panel: "diff",
      diffTurnId: "x",
      diffFilePath: "y",
      other: "keep",
    });
    expect(result).toEqual({ other: "keep" });
  });
});
