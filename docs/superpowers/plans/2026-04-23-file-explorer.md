# File Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file explorer tab to the right panel — a tree browser + CodeMirror editor — alongside the existing diff tab, with full CRUD, git status, and mention integration.

**Architecture:** Refactor the current `DiffPanelInlineSidebar` into a generic `RightPanel` with a tab bar (Files | Diff). The Files tab renders a split-pane file tree + CodeMirror editor. New filesystem/git RPCs are added to `packages/contracts` and served from `apps/server`. The mention system is extended to support `@file:L10-L20` line-range references.

**Tech Stack:** React 19, TanStack Router (URL state), CodeMirror 6, Effect Schema (contracts), custom `<Sidebar>` component (resize), `vscode-icons.ts` (file icons), Lexical (mentions).

---

### Task 1: New Filesystem & Git Status RPC Contracts

**Files:**

- Modify: `packages/contracts/src/filesystem.ts`
- Modify: `packages/contracts/src/rpc.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/filesystem.test.ts`

This task adds the new schemas and RPC definitions for `filesystem.readFile`, `filesystem.listDirectory`, `filesystem.rename`, `filesystem.delete`, `filesystem.createDirectory`, and `git.status`.

- [ ] **Step 1: Write tests for new filesystem schemas**

Create `packages/contracts/src/filesystem.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  FilesystemReadFileInput,
  FilesystemReadFileResult,
  FilesystemListDirectoryInput,
  FilesystemListDirectoryResult,
  FilesystemRenameInput,
  FilesystemDeleteInput,
  FilesystemCreateDirectoryInput,
  FilesystemMutationResult,
  GitFileStatus,
  GitFileStatusResult,
} from "./filesystem.ts";

describe("FilesystemReadFileInput", () => {
  it("accepts valid input", () => {
    const result = Schema.decodeUnknownSync(FilesystemReadFileInput)({
      cwd: "/workspace",
      relativePath: "src/index.ts",
    });
    expect(result.cwd).toBe("/workspace");
    expect(result.relativePath).toBe("src/index.ts");
  });

  it("rejects empty path", () => {
    expect(() =>
      Schema.decodeUnknownSync(FilesystemReadFileInput)({
        cwd: "/workspace",
        relativePath: "",
      }),
    ).toThrow();
  });
});

describe("FilesystemListDirectoryInput", () => {
  it("accepts valid input", () => {
    const result = Schema.decodeUnknownSync(FilesystemListDirectoryInput)({
      cwd: "/workspace",
      relativePath: "src",
    });
    expect(result.relativePath).toBe("src");
  });

  it("accepts root path", () => {
    const result = Schema.decodeUnknownSync(FilesystemListDirectoryInput)({
      cwd: "/workspace",
      relativePath: ".",
    });
    expect(result.relativePath).toBe(".");
  });
});

describe("FilesystemListDirectoryResult", () => {
  it("accepts valid entries", () => {
    const result = Schema.decodeUnknownSync(FilesystemListDirectoryResult)({
      entries: [
        { name: "index.ts", kind: "file", relativePath: "src/index.ts" },
        { name: "components", kind: "directory", relativePath: "src/components" },
      ],
    });
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.kind).toBe("file");
  });
});

describe("FilesystemRenameInput", () => {
  it("accepts valid input", () => {
    const result = Schema.decodeUnknownSync(FilesystemRenameInput)({
      cwd: "/workspace",
      oldRelativePath: "src/old.ts",
      newRelativePath: "src/new.ts",
    });
    expect(result.oldRelativePath).toBe("src/old.ts");
  });
});

describe("GitFileStatusResult", () => {
  it("accepts valid git status output", () => {
    const result = Schema.decodeUnknownSync(GitFileStatusResult)({
      files: [
        { relativePath: "src/index.ts", status: "modified" },
        { relativePath: "src/new.ts", status: "added" },
      ],
    });
    expect(result.files).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test packages/contracts/src/filesystem.test.ts`
Expected: FAIL — schemas not yet defined.

- [ ] **Step 3: Add new schemas to `packages/contracts/src/filesystem.ts`**

Add after the existing `FilesystemBrowseError` class:

```ts
// --- File Explorer RPCs ---

const FILESYSTEM_RELATIVE_PATH_MAX_LENGTH = 512;

export const FilesystemReadFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(
    Schema.isMaxLength(FILESYSTEM_RELATIVE_PATH_MAX_LENGTH),
  ),
});
export type FilesystemReadFileInput = typeof FilesystemReadFileInput.Type;

export const FilesystemReadFileResult = Schema.Struct({
  content: Schema.String,
  encoding: Schema.Literals(["utf-8", "base64"]),
});
export type FilesystemReadFileResult = typeof FilesystemReadFileResult.Type;

export class FilesystemReadFileError extends Schema.TaggedErrorClass<FilesystemReadFileError>()(
  "FilesystemReadFileError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const FilesystemListDirectoryInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(
    Schema.isMaxLength(FILESYSTEM_RELATIVE_PATH_MAX_LENGTH),
  ),
});
export type FilesystemListDirectoryInput = typeof FilesystemListDirectoryInput.Type;

const DirectoryEntryKind = Schema.Literals(["file", "directory"]);

export const DirectoryEntry = Schema.Struct({
  name: TrimmedNonEmptyString,
  kind: DirectoryEntryKind,
  relativePath: TrimmedNonEmptyString,
});
export type DirectoryEntry = typeof DirectoryEntry.Type;

export const FilesystemListDirectoryResult = Schema.Struct({
  entries: Schema.Array(DirectoryEntry),
});
export type FilesystemListDirectoryResult = typeof FilesystemListDirectoryResult.Type;

export class FilesystemListDirectoryError extends Schema.TaggedErrorClass<FilesystemListDirectoryError>()(
  "FilesystemListDirectoryError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export const FilesystemRenameInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  oldRelativePath: TrimmedNonEmptyString.check(
    Schema.isMaxLength(FILESYSTEM_RELATIVE_PATH_MAX_LENGTH),
  ),
  newRelativePath: TrimmedNonEmptyString.check(
    Schema.isMaxLength(FILESYSTEM_RELATIVE_PATH_MAX_LENGTH),
  ),
});
export type FilesystemRenameInput = typeof FilesystemRenameInput.Type;

export const FilesystemDeleteInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(
    Schema.isMaxLength(FILESYSTEM_RELATIVE_PATH_MAX_LENGTH),
  ),
});
export type FilesystemDeleteInput = typeof FilesystemDeleteInput.Type;

export const FilesystemCreateDirectoryInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(
    Schema.isMaxLength(FILESYSTEM_RELATIVE_PATH_MAX_LENGTH),
  ),
});
export type FilesystemCreateDirectoryInput = typeof FilesystemCreateDirectoryInput.Type;

export const FilesystemMutationResult = Schema.Struct({
  success: Schema.Boolean,
});
export type FilesystemMutationResult = typeof FilesystemMutationResult.Type;

export class FilesystemMutationError extends Schema.TaggedErrorClass<FilesystemMutationError>()(
  "FilesystemMutationError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

// --- Git Status for File Explorer ---

export const GitFileStatus = Schema.Literals([
  "modified",
  "added",
  "deleted",
  "untracked",
  "renamed",
  "conflicted",
]);
export type GitFileStatus = typeof GitFileStatus.Type;

export const GitFileStatusEntry = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  status: GitFileStatus,
});
export type GitFileStatusEntry = typeof GitFileStatusEntry.Type;

export const GitFileStatusResult = Schema.Struct({
  files: Schema.Array(GitFileStatusEntry),
});
export type GitFileStatusResult = typeof GitFileStatusResult.Type;

export class GitFileStatusError extends Schema.TaggedErrorClass<GitFileStatusError>()(
  "GitFileStatusError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}
```

- [ ] **Step 4: Add RPC definitions to `packages/contracts/src/rpc.ts`**

Add imports at the top of `rpc.ts`:

```ts
import {
  FilesystemReadFileInput,
  FilesystemReadFileResult,
  FilesystemReadFileError,
  FilesystemListDirectoryInput,
  FilesystemListDirectoryResult,
  FilesystemListDirectoryError,
  FilesystemRenameInput,
  FilesystemDeleteInput,
  FilesystemCreateDirectoryInput,
  FilesystemMutationResult,
  FilesystemMutationError,
  GitFileStatusResult,
  GitFileStatusError,
} from "./filesystem.ts";
```

Add to the `WS_METHODS` object:

```ts
  // Filesystem methods (existing)
  filesystemBrowse: "filesystem.browse",

  // Filesystem methods (file explorer)
  filesystemReadFile: "filesystem.readFile",
  filesystemListDirectory: "filesystem.listDirectory",
  filesystemRename: "filesystem.rename",
  filesystemDelete: "filesystem.delete",
  filesystemCreateDirectory: "filesystem.createDirectory",

  // Git methods (existing stay as-is)
  ...
  // Git methods (file explorer)
  gitFileStatus: "git.fileStatus",
```

Add the Rpc definitions after the existing `WsFilesystemBrowseRpc`:

```ts
export const WsFilesystemReadFileRpc = Rpc.make(WS_METHODS.filesystemReadFile, {
  payload: FilesystemReadFileInput,
  success: FilesystemReadFileResult,
  error: FilesystemReadFileError,
});

export const WsFilesystemListDirectoryRpc = Rpc.make(WS_METHODS.filesystemListDirectory, {
  payload: FilesystemListDirectoryInput,
  success: FilesystemListDirectoryResult,
  error: FilesystemListDirectoryError,
});

export const WsFilesystemRenameRpc = Rpc.make(WS_METHODS.filesystemRename, {
  payload: FilesystemRenameInput,
  success: FilesystemMutationResult,
  error: FilesystemMutationError,
});

export const WsFilesystemDeleteRpc = Rpc.make(WS_METHODS.filesystemDelete, {
  payload: FilesystemDeleteInput,
  success: FilesystemMutationResult,
  error: FilesystemMutationError,
});

export const WsFilesystemCreateDirectoryRpc = Rpc.make(WS_METHODS.filesystemCreateDirectory, {
  payload: FilesystemCreateDirectoryInput,
  success: FilesystemMutationResult,
  error: FilesystemMutationError,
});

export const WsGitFileStatusRpc = Rpc.make(WS_METHODS.gitFileStatus, {
  payload: GitStatusInput,
  success: GitFileStatusResult,
  error: GitFileStatusError,
});
```

Add all six new RPCs to the `WsRpcGroup` call:

```ts
export const WsRpcGroup = RpcGroup.make(
  // ...existing RPCs...
  WsFilesystemReadFileRpc,
  WsFilesystemListDirectoryRpc,
  WsFilesystemRenameRpc,
  WsFilesystemDeleteRpc,
  WsFilesystemCreateDirectoryRpc,
  WsGitFileStatusRpc,
  // ...rest...
);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test packages/contracts/src/filesystem.test.ts`
Expected: PASS

- [ ] **Step 6: Run typecheck**

Run: `bun typecheck`
Expected: Type errors in `apps/server/src/ws.ts` and `apps/web/src/rpc/wsRpcClient.ts` (new RPCs not yet handled). These are expected and will be resolved in subsequent tasks. The contracts package itself should type-check cleanly.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/filesystem.ts packages/contracts/src/filesystem.test.ts packages/contracts/src/rpc.ts
git commit -m "feat(contracts): add filesystem CRUD and git.fileStatus RPC schemas"
```

---

### Task 2: Server-Side Filesystem Service

**Files:**

- Create: `apps/server/src/workspace/Services/WorkspaceFileExplorer.ts`
- Create: `apps/server/src/workspace/Layers/WorkspaceFileExplorer.ts`
- Create: `apps/server/src/workspace/Layers/WorkspaceFileExplorer.test.ts`

This task adds the Effect service that implements `readFile`, `listDirectory`, `rename`, `delete`, and `createDirectory` with workspace-root path containment.

- [ ] **Step 1: Write the service contract**

Create `apps/server/src/workspace/Services/WorkspaceFileExplorer.ts`:

```ts
/**
 * WorkspaceFileExplorer - Effect service contract for workspace file explorer operations.
 *
 * Owns read, list, rename, delete, and create-directory operations scoped to
 * workspace roots. All paths are validated to stay within the workspace root.
 *
 * @module WorkspaceFileExplorer
 */
import { Context } from "effect";
import type { Effect } from "effect";

import type {
  FilesystemReadFileInput,
  FilesystemReadFileResult,
  FilesystemListDirectoryInput,
  FilesystemListDirectoryResult,
  FilesystemRenameInput,
  FilesystemDeleteInput,
  FilesystemCreateDirectoryInput,
  FilesystemMutationResult,
  GitFileStatusResult,
} from "@t3tools/contracts";
import type { WorkspacePathOutsideRootError } from "./WorkspacePaths.ts";

export class WorkspaceFileExplorerError extends Error {
  readonly _tag = "WorkspaceFileExplorerError";
  constructor(
    readonly operation: string,
    readonly detail: string,
    readonly cwd: string,
    override readonly cause?: unknown,
  ) {
    super(`WorkspaceFileExplorer.${operation}: ${detail}`);
  }
}

export interface WorkspaceFileExplorerShape {
  readonly readFile: (
    input: FilesystemReadFileInput,
  ) => Effect.Effect<
    FilesystemReadFileResult,
    WorkspaceFileExplorerError | WorkspacePathOutsideRootError
  >;

  readonly listDirectory: (
    input: FilesystemListDirectoryInput,
  ) => Effect.Effect<
    FilesystemListDirectoryResult,
    WorkspaceFileExplorerError | WorkspacePathOutsideRootError
  >;

  readonly rename: (
    input: FilesystemRenameInput,
  ) => Effect.Effect<
    FilesystemMutationResult,
    WorkspaceFileExplorerError | WorkspacePathOutsideRootError
  >;

  readonly delete: (
    input: FilesystemDeleteInput,
  ) => Effect.Effect<
    FilesystemMutationResult,
    WorkspaceFileExplorerError | WorkspacePathOutsideRootError
  >;

  readonly createDirectory: (
    input: FilesystemCreateDirectoryInput,
  ) => Effect.Effect<
    FilesystemMutationResult,
    WorkspaceFileExplorerError | WorkspacePathOutsideRootError
  >;

  readonly gitFileStatus: (
    cwd: string,
  ) => Effect.Effect<GitFileStatusResult, WorkspaceFileExplorerError>;
}

export class WorkspaceFileExplorer extends Context.Service<
  WorkspaceFileExplorer,
  WorkspaceFileExplorerShape
>()("t3/workspace/Services/WorkspaceFileExplorer") {}
```

- [ ] **Step 2: Write the implementation layer**

Create `apps/server/src/workspace/Layers/WorkspaceFileExplorer.ts`:

```ts
import { Effect, Layer } from "effect";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as childProcess from "node:child_process";

import type {
  FilesystemReadFileInput,
  FilesystemReadFileResult,
  FilesystemListDirectoryInput,
  FilesystemListDirectoryResult,
  FilesystemRenameInput,
  FilesystemDeleteInput,
  FilesystemCreateDirectoryInput,
  FilesystemMutationResult,
  GitFileStatus,
  GitFileStatusResult,
} from "@t3tools/contracts";

import {
  WorkspaceFileExplorer,
  WorkspaceFileExplorerError,
} from "../Services/WorkspaceFileExplorer.ts";
import { WorkspacePaths } from "../Services/WorkspacePaths.ts";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

function execGitStatus(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    childProcess.execFile(
      "git",
      ["status", "--porcelain=v1", "-uall"],
      { cwd, maxBuffer: 1024 * 1024, timeout: 10_000 },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function parseGitStatusCode(code: string): GitFileStatus {
  const trimmed = code.trim();
  if (trimmed === "M" || trimmed === "MM" || trimmed === "AM") return "modified";
  if (trimmed === "A") return "added";
  if (trimmed === "D") return "deleted";
  if (trimmed === "??" || trimmed === "?") return "untracked";
  if (trimmed.startsWith("R")) return "renamed";
  if (trimmed === "UU" || trimmed === "AA" || trimmed === "DD") return "conflicted";
  return "modified"; // fallback
}

export const WorkspaceFileExplorerLive = Layer.effect(
  WorkspaceFileExplorer,
  Effect.gen(function* () {
    const workspacePaths = yield* WorkspacePaths;

    return WorkspaceFileExplorer.of({
      readFile: (input: FilesystemReadFileInput) =>
        Effect.gen(function* () {
          const resolvedPath = yield* workspacePaths.resolve(input.cwd, input.relativePath);
          const stats = yield* Effect.tryPromise({
            try: () => fs.stat(resolvedPath),
            catch: (error) =>
              new WorkspaceFileExplorerError(
                "readFile",
                `File not found: ${input.relativePath}`,
                input.cwd,
                error,
              ),
          });

          if (!stats.isFile()) {
            return yield* Effect.fail(
              new WorkspaceFileExplorerError(
                "readFile",
                `Not a file: ${input.relativePath}`,
                input.cwd,
              ),
            );
          }

          if (stats.size > MAX_FILE_SIZE_BYTES) {
            return yield* Effect.fail(
              new WorkspaceFileExplorerError(
                "readFile",
                `File too large (${stats.size} bytes, max ${MAX_FILE_SIZE_BYTES})`,
                input.cwd,
              ),
            );
          }

          const buffer = yield* Effect.tryPromise({
            try: () => fs.readFile(resolvedPath),
            catch: (error) =>
              new WorkspaceFileExplorerError(
                "readFile",
                `Failed to read: ${input.relativePath}`,
                input.cwd,
                error,
              ),
          });

          // Detect binary content by checking for null bytes in first 8KB
          const sample = buffer.subarray(0, 8192);
          const isBinary = sample.includes(0);

          const result: FilesystemReadFileResult = isBinary
            ? { content: buffer.toString("base64"), encoding: "base64" as const }
            : { content: buffer.toString("utf-8"), encoding: "utf-8" as const };

          return result;
        }),

      listDirectory: (input: FilesystemListDirectoryInput) =>
        Effect.gen(function* () {
          const resolvedPath = yield* workspacePaths.resolve(input.cwd, input.relativePath);
          const dirents = yield* Effect.tryPromise({
            try: () => fs.readdir(resolvedPath, { withFileTypes: true }),
            catch: (error) =>
              new WorkspaceFileExplorerError(
                "listDirectory",
                `Failed to list: ${input.relativePath}`,
                input.cwd,
                error,
              ),
          });

          const entries = dirents
            .filter((d) => !d.name.startsWith("."))
            .map((d) => ({
              name: d.name,
              kind: d.isDirectory() ? ("directory" as const) : ("file" as const),
              relativePath: path.join(input.relativePath === "." ? "" : input.relativePath, d.name),
            }))
            .sort((a, b) => {
              // Directories first, then alphabetical
              if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
              return a.name.localeCompare(b.name);
            });

          const result: FilesystemListDirectoryResult = { entries };
          return result;
        }),

      rename: (input: FilesystemRenameInput) =>
        Effect.gen(function* () {
          const oldResolved = yield* workspacePaths.resolve(input.cwd, input.oldRelativePath);
          const newResolved = yield* workspacePaths.resolve(input.cwd, input.newRelativePath);

          // Ensure parent directory for new path exists
          yield* Effect.tryPromise({
            try: () => fs.mkdir(path.dirname(newResolved), { recursive: true }),
            catch: (error) =>
              new WorkspaceFileExplorerError(
                "rename",
                `Failed to create parent directory`,
                input.cwd,
                error,
              ),
          });

          yield* Effect.tryPromise({
            try: () => fs.rename(oldResolved, newResolved),
            catch: (error) =>
              new WorkspaceFileExplorerError(
                "rename",
                `Failed to rename ${input.oldRelativePath} to ${input.newRelativePath}`,
                input.cwd,
                error,
              ),
          });

          const result: FilesystemMutationResult = { success: true };
          return result;
        }),

      delete: (input: FilesystemDeleteInput) =>
        Effect.gen(function* () {
          const resolvedPath = yield* workspacePaths.resolve(input.cwd, input.relativePath);

          yield* Effect.tryPromise({
            try: () => fs.rm(resolvedPath, { recursive: true }),
            catch: (error) =>
              new WorkspaceFileExplorerError(
                "delete",
                `Failed to delete: ${input.relativePath}`,
                input.cwd,
                error,
              ),
          });

          const result: FilesystemMutationResult = { success: true };
          return result;
        }),

      createDirectory: (input: FilesystemCreateDirectoryInput) =>
        Effect.gen(function* () {
          const resolvedPath = yield* workspacePaths.resolve(input.cwd, input.relativePath);

          yield* Effect.tryPromise({
            try: () => fs.mkdir(resolvedPath, { recursive: true }),
            catch: (error) =>
              new WorkspaceFileExplorerError(
                "createDirectory",
                `Failed to create directory: ${input.relativePath}`,
                input.cwd,
                error,
              ),
          });

          const result: FilesystemMutationResult = { success: true };
          return result;
        }),

      gitFileStatus: (cwd: string) =>
        Effect.gen(function* () {
          const stdout = yield* Effect.tryPromise({
            try: () => execGitStatus(cwd),
            catch: (error) =>
              new WorkspaceFileExplorerError(
                "gitFileStatus",
                "Failed to run git status",
                cwd,
                error,
              ),
          });

          const files = stdout
            .split("\n")
            .filter((line) => line.length >= 4)
            .map((line) => ({
              relativePath: line.slice(3).trim(),
              status: parseGitStatusCode(line.slice(0, 2)),
            }));

          const result: GitFileStatusResult = { files };
          return result;
        }),
    });
  }),
);
```

- [ ] **Step 3: Read `WorkspacePaths` service to verify the `resolve` method signature**

The implementation above uses `workspacePaths.resolve(cwd, relativePath)`. Before proceeding, verify that `WorkspacePaths` has a `.resolve()` method. Read `apps/server/src/workspace/Services/WorkspacePaths.ts` and check the interface. If the method is named differently (e.g., `resolvePath` or uses a different signature), update the `WorkspaceFileExplorer` layer implementation to match.

- [ ] **Step 4: Run typecheck**

Run: `bun typecheck`
Expected: Server-side types should be clean for the new service files. WebSocket handler errors remain (addressed in Task 3).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/workspace/Services/WorkspaceFileExplorer.ts apps/server/src/workspace/Layers/WorkspaceFileExplorer.ts
git commit -m "feat(server): add WorkspaceFileExplorer service for filesystem CRUD and git status"
```

---

### Task 3: Wire Server-Side RPC Handlers

**Files:**

- Modify: `apps/server/src/ws.ts`

This task wires the new RPCs to the `WorkspaceFileExplorer` service in the WebSocket handler map.

- [ ] **Step 1: Add import for `WorkspaceFileExplorer` at top of `ws.ts`**

Add near the other workspace imports:

```ts
import { WorkspaceFileExplorer } from "./workspace/Services/WorkspaceFileExplorer.ts";
```

Also add the new error/type imports from contracts:

```ts
import {
  // ...existing imports...
  FilesystemReadFileError,
  FilesystemListDirectoryError,
  FilesystemMutationError,
  GitFileStatusError,
} from "@t3tools/contracts";
```

- [ ] **Step 2: Yield the `WorkspaceFileExplorer` service in the handler setup**

In the `Effect.gen` function that creates the handler map, add:

```ts
const workspaceFileExplorer = yield * WorkspaceFileExplorer;
```

This should be near the existing `const workspaceEntries = yield* WorkspaceEntries;` line.

- [ ] **Step 3: Add RPC handlers to the handler map**

Add these entries to the handler record (alongside the existing `[WS_METHODS.filesystemBrowse]` handler):

```ts
[WS_METHODS.filesystemReadFile]: (input) =>
  observeRpcEffect(
    WS_METHODS.filesystemReadFile,
    workspaceFileExplorer.readFile(input).pipe(
      Effect.mapError(
        (cause) =>
          new FilesystemReadFileError({
            message: cause instanceof Error ? cause.message : "Failed to read file",
            cause,
          }),
      ),
    ),
    { "rpc.aggregate": "workspace" },
  ),
[WS_METHODS.filesystemListDirectory]: (input) =>
  observeRpcEffect(
    WS_METHODS.filesystemListDirectory,
    workspaceFileExplorer.listDirectory(input).pipe(
      Effect.mapError(
        (cause) =>
          new FilesystemListDirectoryError({
            message: cause instanceof Error ? cause.message : "Failed to list directory",
            cause,
          }),
      ),
    ),
    { "rpc.aggregate": "workspace" },
  ),
[WS_METHODS.filesystemRename]: (input) =>
  observeRpcEffect(
    WS_METHODS.filesystemRename,
    workspaceFileExplorer.rename(input).pipe(
      Effect.mapError(
        (cause) =>
          new FilesystemMutationError({
            message: cause instanceof Error ? cause.message : "Failed to rename",
            cause,
          }),
      ),
    ),
    { "rpc.aggregate": "workspace" },
  ),
[WS_METHODS.filesystemDelete]: (input) =>
  observeRpcEffect(
    WS_METHODS.filesystemDelete,
    workspaceFileExplorer.delete(input).pipe(
      Effect.mapError(
        (cause) =>
          new FilesystemMutationError({
            message: cause instanceof Error ? cause.message : "Failed to delete",
            cause,
          }),
      ),
    ),
    { "rpc.aggregate": "workspace" },
  ),
[WS_METHODS.filesystemCreateDirectory]: (input) =>
  observeRpcEffect(
    WS_METHODS.filesystemCreateDirectory,
    workspaceFileExplorer.createDirectory(input).pipe(
      Effect.mapError(
        (cause) =>
          new FilesystemMutationError({
            message: cause instanceof Error ? cause.message : "Failed to create directory",
            cause,
          }),
      ),
    ),
    { "rpc.aggregate": "workspace" },
  ),
[WS_METHODS.gitFileStatus]: (input) =>
  observeRpcEffect(
    WS_METHODS.gitFileStatus,
    workspaceFileExplorer.gitFileStatus(input.cwd).pipe(
      Effect.mapError(
        (cause) =>
          new GitFileStatusError({
            message: cause instanceof Error ? cause.message : "Failed to get git status",
            cause,
          }),
      ),
    ),
    { "rpc.aggregate": "git" },
  ),
```

- [ ] **Step 4: Provide the `WorkspaceFileExplorer` layer in the server composition**

Find where `WorkspaceEntries` layer is provided to the server (likely in the server's main composition file or in `ws.ts`'s layer setup). Add `WorkspaceFileExplorerLive` to the layer composition.

Import in the composition file:

```ts
import { WorkspaceFileExplorerLive } from "./workspace/Layers/WorkspaceFileExplorer.ts";
```

Add to the layer:

```ts
Layer.merge(WorkspaceFileExplorerLive);
```

- [ ] **Step 5: Run typecheck**

Run: `bun typecheck`
Expected: Server should now compile cleanly. Client may still have type errors (resolved in Task 4).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/ws.ts
git commit -m "feat(server): wire filesystem and git.fileStatus RPC handlers"
```

---

### Task 4: Client-Side RPC Wiring

**Files:**

- Modify: `apps/web/src/rpc/wsRpcClient.ts`
- Modify: `apps/web/src/environmentApi.ts`
- Modify: `packages/contracts/src/ipc.ts`

This task exposes the new RPCs on the client-side `WsRpcClient` and `EnvironmentApi`.

- [ ] **Step 1: Add new methods to `WsRpcClient` interface in `wsRpcClient.ts`**

Extend the `filesystem` section of the `WsRpcClient` interface:

```ts
readonly filesystem: {
  readonly browse: RpcUnaryMethod<typeof WS_METHODS.filesystemBrowse>;
  readonly readFile: RpcUnaryMethod<typeof WS_METHODS.filesystemReadFile>;
  readonly listDirectory: RpcUnaryMethod<typeof WS_METHODS.filesystemListDirectory>;
  readonly rename: RpcUnaryMethod<typeof WS_METHODS.filesystemRename>;
  readonly delete: RpcUnaryMethod<typeof WS_METHODS.filesystemDelete>;
  readonly createDirectory: RpcUnaryMethod<typeof WS_METHODS.filesystemCreateDirectory>;
};
```

Add to the `git` section:

```ts
readonly fileStatus: RpcUnaryMethod<typeof WS_METHODS.gitFileStatus>;
```

- [ ] **Step 2: Add implementations in `createWsRpcClient`**

In the `filesystem` section of the returned object:

```ts
filesystem: {
  browse: (input) => transport.request((client) => client[WS_METHODS.filesystemBrowse](input)),
  readFile: (input) =>
    transport.request((client) => client[WS_METHODS.filesystemReadFile](input)),
  listDirectory: (input) =>
    transport.request((client) => client[WS_METHODS.filesystemListDirectory](input)),
  rename: (input) =>
    transport.request((client) => client[WS_METHODS.filesystemRename](input)),
  delete: (input) =>
    transport.request((client) => client[WS_METHODS.filesystemDelete](input)),
  createDirectory: (input) =>
    transport.request((client) => client[WS_METHODS.filesystemCreateDirectory](input)),
},
```

In the `git` section, add:

```ts
fileStatus: (input) =>
  transport.request((client) => client[WS_METHODS.gitFileStatus](input)),
```

- [ ] **Step 3: Extend `EnvironmentApi` interface in `packages/contracts/src/ipc.ts`**

Add to the `filesystem` section of `EnvironmentApi`:

```ts
filesystem: {
  browse: (input: FilesystemBrowseInput) => Promise<FilesystemBrowseResult>;
  readFile: (input: FilesystemReadFileInput) => Promise<FilesystemReadFileResult>;
  listDirectory: (input: FilesystemListDirectoryInput) => Promise<FilesystemListDirectoryResult>;
  rename: (input: FilesystemRenameInput) => Promise<FilesystemMutationResult>;
  delete: (input: FilesystemDeleteInput) => Promise<FilesystemMutationResult>;
  createDirectory: (input: FilesystemCreateDirectoryInput) => Promise<FilesystemMutationResult>;
};
```

Add to the `git` section:

```ts
fileStatus: (input: GitStatusInput) => Promise<GitFileStatusResult>;
```

Add the new type imports at the top of `ipc.ts`.

- [ ] **Step 4: Wire the new methods in `environmentApi.ts`**

Update the `filesystem` and `git` sections in `createEnvironmentApi`:

```ts
filesystem: {
  browse: rpcClient.filesystem.browse,
  readFile: rpcClient.filesystem.readFile,
  listDirectory: rpcClient.filesystem.listDirectory,
  rename: rpcClient.filesystem.rename,
  delete: rpcClient.filesystem.delete,
  createDirectory: rpcClient.filesystem.createDirectory,
},
```

In `git`, add:

```ts
fileStatus: rpcClient.git.fileStatus,
```

- [ ] **Step 5: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: PASS — full client/server type chain should be clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/rpc/wsRpcClient.ts apps/web/src/environmentApi.ts packages/contracts/src/ipc.ts
git commit -m "feat(web): wire filesystem CRUD and git.fileStatus RPC to client"
```

---

### Task 5: URL State — Replace `?diff=1` with `?panel=files|diff`

**Files:**

- Rename: `apps/web/src/diffRouteSearch.ts` → `apps/web/src/panelRouteSearch.ts`
- Modify: `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`
- Modify: any other files importing from `diffRouteSearch.ts`

This task replaces the `?diff=1` URL param with `?panel=files` / `?panel=diff`.

- [ ] **Step 1: Create `panelRouteSearch.ts` to replace `diffRouteSearch.ts`**

Create `apps/web/src/panelRouteSearch.ts`:

```ts
import { TurnId } from "@t3tools/contracts";

export type PanelTab = "files" | "diff";

export interface PanelRouteSearch {
  panel?: PanelTab | undefined;
  diffTurnId?: TurnId | undefined;
  diffFilePath?: string | undefined;
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
): Omit<T, "panel" | "diffTurnId" | "diffFilePath"> {
  const { panel: _panel, diffTurnId: _diffTurnId, diffFilePath: _diffFilePath, ...rest } = params;
  return rest as Omit<T, "panel" | "diffTurnId" | "diffFilePath">;
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
  const diffTurnIdRaw = isDiff ? normalizeSearchString(search.diffTurnId) : undefined;
  const diffTurnId = diffTurnIdRaw ? TurnId.make(diffTurnIdRaw) : undefined;
  const diffFilePath =
    isDiff && diffTurnId ? normalizeSearchString(search.diffFilePath) : undefined;

  return {
    ...(panel ? { panel } : {}),
    ...(diffTurnId ? { diffTurnId } : {}),
    ...(diffFilePath ? { diffFilePath } : {}),
  };
}
```

- [ ] **Step 2: Write tests for the new panel route search**

Create `apps/web/src/panelRouteSearch.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests**

Run: `bun run test apps/web/src/panelRouteSearch.test.ts`
Expected: PASS

- [ ] **Step 4: Update all imports from `diffRouteSearch` to `panelRouteSearch`**

Search the codebase for all files importing from `diffRouteSearch` and update them. Key files:

- `apps/web/src/routes/_chat.$environmentId.$threadId.tsx` — change import and update usage
- Any other component files that import `DiffRouteSearch`, `parseDiffRouteSearch`, or `stripDiffSearchParams`

In the route file, update:

```ts
// Before
import {
  type DiffRouteSearch,
  parseDiffRouteSearch,
  stripDiffSearchParams,
} from "../diffRouteSearch";

// After
import {
  type PanelRouteSearch,
  type PanelTab,
  parsePanelRouteSearch,
  stripPanelSearchParams,
} from "../panelRouteSearch";
```

Update route `validateSearch`:

```ts
// Before
validateSearch: (search) => parseDiffRouteSearch(search),
search: { middlewares: [retainSearchParams<DiffRouteSearch>(["diff"])] },

// After
validateSearch: (search) => parsePanelRouteSearch(search),
search: { middlewares: [retainSearchParams<PanelRouteSearch>(["panel"])] },
```

Update the `diffOpen` / navigation logic in `ChatThreadRouteView`:

```ts
// Before
const diffOpen = search.diff === "1";

// After
const panelTab = search.panel; // "files" | "diff" | undefined
const diffOpen = panelTab === "diff";
const filesOpen = panelTab === "files";
const panelOpen = panelTab !== undefined;
```

Update `closeDiff`:

```ts
// Before
search: {
  diff: undefined;
}

// After
search: {
  panel: undefined;
}
```

Update `openDiff`:

```ts
// Before
search: (previous) => ({ ...stripDiffSearchParams(previous), diff: "1" });

// After
search: (previous) => ({ ...stripPanelSearchParams(previous), panel: "diff" as const });
```

Add `openFiles` and `closePanel` navigation helpers:

```ts
const openFiles = useCallback(() => {
  if (!threadRef) return;
  void navigate({
    to: "/$environmentId/$threadId",
    params: buildThreadRouteParams(threadRef),
    search: (previous) => ({
      ...stripPanelSearchParams(previous),
      panel: "files" as const,
    }),
  });
}, [navigate, threadRef]);

const closePanel = useCallback(() => {
  if (!threadRef) return;
  void navigate({
    to: "/$environmentId/$threadId",
    params: buildThreadRouteParams(threadRef),
    search: { panel: undefined },
  });
}, [navigate, threadRef]);
```

- [ ] **Step 5: Update ChatView.tsx diff toggle references**

In `apps/web/src/components/ChatView.tsx`, find where `rawSearch.diff === "1"` is referenced and update to `rawSearch.panel === "diff"`. Also update the toggle function to use `panel: "diff"` / `panel: undefined`.

- [ ] **Step 6: Delete the old `diffRouteSearch.ts` file**

Once all references are updated, delete `apps/web/src/diffRouteSearch.ts`.

- [ ] **Step 7: Run typecheck, lint, and tests**

Run: `bun typecheck && bun lint && bun run test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(web): replace ?diff=1 with ?panel=files|diff URL state"
```

---

### Task 6: Refactor DiffPanelInlineSidebar → RightPanel with Tab Bar

**Files:**

- Create: `apps/web/src/components/RightPanel.tsx`
- Create: `apps/web/src/components/RightPanelTabBar.tsx`
- Modify: `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`
- Modify: `apps/web/src/components/RightPanelSheet.tsx`
- Modify: `apps/web/src/rightPanelLayout.ts`

This task extracts the inline sidebar into a generic `RightPanel` that renders a tab bar and switches between Files/Diff content.

- [ ] **Step 1: Create `RightPanelTabBar.tsx`**

Create `apps/web/src/components/RightPanelTabBar.tsx`:

```tsx
import type { PanelTab } from "../panelRouteSearch";
import { FilesIcon, GitCompareArrowsIcon } from "lucide-react";

interface RightPanelTabBarProps {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
}

export function RightPanelTabBar({ activeTab, onTabChange }: RightPanelTabBarProps) {
  return (
    <div className="flex h-9 shrink-0 items-center border-b border-border bg-card px-2 gap-1">
      <button
        type="button"
        onClick={() => onTabChange("files")}
        className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
          activeTab === "files"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
      >
        <FilesIcon className="size-3.5" />
        Files
      </button>
      <button
        type="button"
        onClick={() => onTabChange("diff")}
        className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
          activeTab === "diff"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
      >
        <GitCompareArrowsIcon className="size-3.5" />
        Diff
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `RightPanel.tsx`**

Create `apps/web/src/components/RightPanel.tsx`:

```tsx
import { useCallback, type ReactNode } from "react";
import { Sidebar, SidebarProvider, SidebarRail } from "~/components/ui/sidebar";
import type { PanelTab } from "../panelRouteSearch";
import { RightPanelTabBar } from "./RightPanelTabBar";

const SIDEBAR_WIDTH_STORAGE_KEY = "chat_right_panel_width";

// Files tab is wider because it has a tree + editor split
const DEFAULT_WIDTH_BY_TAB: Record<PanelTab, string> = {
  files: "clamp(36rem,52vw,56rem)",
  diff: "clamp(28rem,48vw,44rem)",
};

const MIN_WIDTH_BY_TAB: Record<PanelTab, number> = {
  files: 36 * 16, // 576px
  diff: 26 * 16, // 416px
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
```

- [ ] **Step 3: Update the route file to use `RightPanel`**

In `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`, replace `DiffPanelInlineSidebar` with the new `RightPanel`:

```tsx
import { RightPanel } from "../components/RightPanel";
import { RightPanelTabBar } from "../components/RightPanelTabBar";
```

Remove the `DiffPanelInlineSidebar` component definition entirely.

Update the inline-sidebar rendering branch of `ChatThreadRouteView`:

```tsx
if (!shouldUseDiffSheet) {
  return (
    <>
      <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <ChatView
          environmentId={threadRef.environmentId}
          threadId={threadRef.threadId}
          onDiffPanelOpen={markDiffOpened}
          reserveTitleBarControlInset={!panelOpen}
          routeKind="server"
        />
      </SidebarInset>
      <RightPanel
        activeTab={panelTab ?? "diff"}
        open={panelOpen}
        onTabChange={(tab) => {
          if (tab === "diff") {
            markDiffOpened();
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
        {/* Diff tab content: stays mounted once opened, hidden when not active */}
        <div style={{ display: panelTab === "diff" ? "contents" : "none" }}>
          {shouldRenderDiffContent ? <LazyDiffPanel mode="sidebar" /> : null}
        </div>
        {/* Files tab content: placeholder for now, implemented in Task 8 */}
        <div style={{ display: panelTab === "files" ? "contents" : "none" }}>
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            File explorer coming soon
          </div>
        </div>
      </RightPanel>
    </>
  );
}
```

- [ ] **Step 4: Update the sheet branch for narrow viewports**

Update the sheet rendering branch to include the tab bar:

```tsx
return (
  <>
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <ChatView
        environmentId={threadRef.environmentId}
        threadId={threadRef.threadId}
        onDiffPanelOpen={markDiffOpened}
        routeKind="server"
      />
    </SidebarInset>
    <RightPanelSheet open={panelOpen} onClose={closePanel}>
      <RightPanelTabBar
        activeTab={panelTab ?? "diff"}
        onTabChange={(tab) => {
          if (tab === "diff") markDiffOpened();
          void navigate({
            to: "/$environmentId/$threadId",
            params: buildThreadRouteParams(threadRef),
            search: (prev) => ({ ...stripPanelSearchParams(prev), panel: tab }),
          });
        }}
      />
      <div style={{ display: panelTab === "diff" ? "contents" : "none" }}>
        {shouldRenderDiffContent ? <LazyDiffPanel mode="sheet" /> : null}
      </div>
      <div style={{ display: panelTab === "files" ? "contents" : "none" }}>
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          File explorer coming soon
        </div>
      </div>
    </RightPanelSheet>
  </>
);
```

- [ ] **Step 5: Clean up unused imports and old constants**

Remove the now-unused constants from the route file:

```ts
// Remove these (now in RightPanel.tsx):
const DIFF_INLINE_SIDEBAR_WIDTH_STORAGE_KEY = ...
const DIFF_INLINE_DEFAULT_WIDTH = ...
const DIFF_INLINE_SIDEBAR_MIN_WIDTH = ...
const COMPOSER_COMPACT_MIN_LEFT_CONTROLS_WIDTH_PX = ...
```

- [ ] **Step 6: Run typecheck, lint, and format**

Run: `bun typecheck && bun lint && bun fmt`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(web): extract RightPanel with tab bar from DiffPanelInlineSidebar"
```

---

### Task 7: File Tree Component (Left Pane)

**Files:**

- Create: `apps/web/src/components/file-explorer/FileTree.tsx`
- Create: `apps/web/src/components/file-explorer/FileTreeNode.tsx`
- Create: `apps/web/src/components/file-explorer/FileTreeFilter.tsx`
- Create: `apps/web/src/components/file-explorer/useFileTree.ts`
- Create: `apps/web/src/components/file-explorer/useGitFileStatus.ts`
- Create: `apps/web/src/components/file-explorer/types.ts`

This task builds the expand-on-demand directory tree with git status badges and quick filter.

- [ ] **Step 1: Create shared types**

Create `apps/web/src/components/file-explorer/types.ts`:

```ts
import type { DirectoryEntry, GitFileStatus } from "@t3tools/contracts";

export interface TreeNode {
  readonly entry: DirectoryEntry;
  readonly depth: number;
  readonly isExpanded: boolean;
  readonly isLoading: boolean;
  readonly children: readonly TreeNode[] | null; // null = not loaded yet
  readonly gitStatus?: GitFileStatus | undefined;
}

export interface FileTreeState {
  readonly rootPath: string;
  readonly nodes: ReadonlyMap<string, TreeNode>;
  readonly expandedPaths: ReadonlySet<string>;
  readonly rootEntries: readonly DirectoryEntry[];
}
```

- [ ] **Step 2: Create the `useFileTree` hook**

Create `apps/web/src/components/file-explorer/useFileTree.ts`:

```ts
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
```

- [ ] **Step 3: Create the `useGitFileStatus` hook**

Create `apps/web/src/components/file-explorer/useGitFileStatus.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { EnvironmentId, GitFileStatusResult, GitFileStatus } from "@t3tools/contracts";
import { readEnvironmentApi } from "../../environmentApi";

const POLL_INTERVAL_MS = 3_000;

interface UseGitFileStatusOptions {
  environmentId: EnvironmentId;
  cwd: string;
  enabled: boolean;
}

export function useGitFileStatus({ environmentId, cwd, enabled }: UseGitFileStatusOptions) {
  const [statusMap, setStatusMap] = useState<ReadonlyMap<string, GitFileStatus>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    const api = readEnvironmentApi(environmentId);
    if (!api) return;

    try {
      const result: GitFileStatusResult = await api.git.fileStatus({ cwd });
      const next = new Map<string, GitFileStatus>();
      for (const file of result.files) {
        next.set(file.relativePath, file.status);
      }
      setStatusMap(next);
    } catch {
      // Silently ignore — git status polling is best-effort
    }
  }, [environmentId, cwd]);

  useEffect(() => {
    if (!enabled) return;

    void fetchStatus();
    timerRef.current = setInterval(() => void fetchStatus(), POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, fetchStatus]);

  return { statusMap, refresh: fetchStatus };
}
```

- [ ] **Step 4: Create `FileTreeFilter.tsx`**

Create `apps/web/src/components/file-explorer/FileTreeFilter.tsx`:

```tsx
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
    <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
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
  );
}
```

- [ ] **Step 5: Create `FileTreeNode.tsx`**

Create `apps/web/src/components/file-explorer/FileTreeNode.tsx`:

```tsx
import { ChevronRightIcon } from "lucide-react";
import type { DirectoryEntry, GitFileStatus } from "@t3tools/contracts";
import { getVscodeIconUrlForEntry } from "../../vscode-icons";

const GIT_STATUS_LABELS: Record<GitFileStatus, { label: string; className: string }> = {
  modified: { label: "M", className: "text-yellow-500" },
  added: { label: "A", className: "text-green-500" },
  deleted: { label: "D", className: "text-red-500" },
  untracked: { label: "?", className: "text-gray-400" },
  renamed: { label: "R", className: "text-blue-500" },
  conflicted: { label: "U", className: "text-orange-500" },
};

interface FileTreeNodeProps {
  entry: DirectoryEntry;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  gitStatus: GitFileStatus | undefined;
  theme: "light" | "dark";
  onToggleExpand: (relativePath: string) => void;
  onSelectFile: (relativePath: string) => void;
  onContextMenu: (event: React.MouseEvent, entry: DirectoryEntry) => void;
}

export function FileTreeNode({
  entry,
  depth,
  isExpanded,
  isLoading,
  gitStatus,
  theme,
  onToggleExpand,
  onSelectFile,
  onContextMenu,
}: FileTreeNodeProps) {
  const isDir = entry.kind === "directory";
  const iconUrl = getVscodeIconUrlForEntry(
    entry.relativePath,
    isDir && isExpanded ? "directory" : entry.kind,
    theme,
  );
  const statusInfo = gitStatus ? GIT_STATUS_LABELS[gitStatus] : undefined;

  const handleClick = () => {
    if (isDir) {
      onToggleExpand(entry.relativePath);
    } else {
      onSelectFile(entry.relativePath);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, entry)}
      className="flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-xs hover:bg-accent/50 text-left group"
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
    >
      {isDir ? (
        <ChevronRightIcon
          className={`size-3 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
        />
      ) : (
        <span className="size-3 shrink-0" />
      )}
      <img src={iconUrl} alt="" className="size-4 shrink-0" />
      <span className="truncate flex-1">{entry.name}</span>
      {isLoading && <span className="text-[10px] text-muted-foreground animate-pulse">...</span>}
      {statusInfo && (
        <span className={`text-[10px] font-mono shrink-0 ${statusInfo.className}`}>
          {statusInfo.label}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 6: Create `FileTree.tsx`**

Create `apps/web/src/components/file-explorer/FileTree.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DirectoryEntry, EnvironmentId, GitFileStatus } from "@t3tools/contracts";
import { useFileTree } from "./useFileTree";
import { useGitFileStatus } from "./useGitFileStatus";
import { FileTreeFilter } from "./FileTreeFilter";
import { FileTreeNode } from "./FileTreeNode";

interface FileTreeProps {
  environmentId: EnvironmentId;
  cwd: string;
  theme: "light" | "dark";
  onSelectFile: (relativePath: string) => void;
  onContextMenu: (event: React.MouseEvent, entry: DirectoryEntry) => void;
}

interface FlatEntry {
  entry: DirectoryEntry;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
}

export function FileTree({
  environmentId,
  cwd,
  theme,
  onSelectFile,
  onContextMenu,
}: FileTreeProps) {
  const { rootEntries, rootLoading, expandedDirs, loadRoot, toggleExpand } = useFileTree({
    environmentId,
    cwd,
  });
  const { statusMap } = useGitFileStatus({ environmentId, cwd, enabled: true });
  const [filter, setFilter] = useState("");

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  // Flatten tree for rendering
  const flatEntries = useMemo(() => {
    if (!rootEntries) return [];
    const result: FlatEntry[] = [];
    const lowerFilter = filter.toLowerCase();

    function walk(entries: readonly DirectoryEntry[], depth: number) {
      for (const entry of entries) {
        const matchesFilter =
          lowerFilter.length === 0 || entry.name.toLowerCase().includes(lowerFilter);
        const dirData =
          entry.kind === "directory" ? expandedDirs.get(entry.relativePath) : undefined;
        const isExpanded = dirData !== undefined;
        const isLoading = dirData?.isLoading ?? false;
        const children = dirData?.entries ?? [];

        // For directories: show if matches filter OR has matching children
        // For files: show if matches filter
        if (entry.kind === "directory") {
          if (matchesFilter || lowerFilter.length === 0) {
            result.push({ entry, depth, isExpanded, isLoading });
          }
          if (isExpanded) {
            walk(children, depth + 1);
          }
        } else if (matchesFilter) {
          result.push({ entry, depth, isExpanded: false, isLoading: false });
        }
      }
    }

    walk(rootEntries, 0);
    return result;
  }, [rootEntries, expandedDirs, filter]);

  if (rootLoading && !rootEntries) {
    return (
      <div className="flex flex-col h-full">
        <FileTreeFilter value={filter} onChange={setFilter} />
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FileTreeFilter value={filter} onChange={setFilter} />
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {flatEntries.map((item) => (
          <FileTreeNode
            key={item.entry.relativePath}
            entry={item.entry}
            depth={item.depth}
            isExpanded={item.isExpanded}
            isLoading={item.isLoading}
            gitStatus={statusMap.get(item.entry.relativePath)}
            theme={theme}
            onToggleExpand={toggleExpand}
            onSelectFile={onSelectFile}
            onContextMenu={onContextMenu}
          />
        ))}
        {flatEntries.length === 0 && rootEntries && (
          <div className="px-2 py-4 text-xs text-muted-foreground text-center">
            {filter.length > 0 ? "No matching files" : "Empty directory"}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run typecheck and lint**

Run: `bun typecheck && bun lint && bun fmt`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/file-explorer/
git commit -m "feat(web): add FileTree component with expand-on-demand, git status, and filter"
```

---

### Task 8: CodeMirror Editor Component (Right Pane)

**Files:**

- Create: `apps/web/src/components/file-explorer/CodeEditor.tsx`
- Create: `apps/web/src/components/file-explorer/EditorTabs.tsx`
- Create: `apps/web/src/components/file-explorer/EditorBreadcrumb.tsx`
- Create: `apps/web/src/components/file-explorer/useEditorTabs.ts`
- Create: `apps/web/src/components/file-explorer/languageExtensions.ts`

This task builds the CodeMirror-powered code editor with multi-tab support.

- [ ] **Step 1: Install CodeMirror dependencies**

Run:

```bash
cd apps/web && bun add codemirror @codemirror/view @codemirror/state @codemirror/language @codemirror/lang-javascript @codemirror/lang-css @codemirror/lang-html @codemirror/lang-json @codemirror/lang-markdown @codemirror/lang-python @codemirror/lang-rust @codemirror/lang-cpp @codemirror/lang-java @codemirror/lang-xml @codemirror/lang-sql @codemirror/lang-yaml @codemirror/theme-one-dark
```

- [ ] **Step 2: Create `languageExtensions.ts`**

Create `apps/web/src/components/file-explorer/languageExtensions.ts`:

```ts
import type { Extension } from "@codemirror/state";

const EXTENSION_MAP: Record<string, () => Promise<Extension>> = {
  ts: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  tsx: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true, jsx: true }),
    ),
  js: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  jsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  mjs: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  cjs: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  md: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  py: () => import("@codemirror/lang-python").then((m) => m.python()),
  rs: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  cpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  c: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  h: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  java: () => import("@codemirror/lang-java").then((m) => m.java()),
  xml: () => import("@codemirror/lang-xml").then((m) => m.xml()),
  svg: () => import("@codemirror/lang-xml").then((m) => m.xml()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  yaml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  yml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
};

export function getLanguageExtension(filePath: string): (() => Promise<Extension>) | undefined {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  return EXTENSION_MAP[ext];
}
```

- [ ] **Step 3: Create `useEditorTabs.ts`**

Create `apps/web/src/components/file-explorer/useEditorTabs.ts`:

```ts
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
        // Find the oldest non-dirty, non-active tab to evict
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
          // All non-active tabs are dirty — don't evict, just deny
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

      // Guard against closing dirty tabs
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
      } else if (index === activeIndex && activeIndex >= tabs.length) {
        activeIndex = tabs.length - 1;
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
```

- [ ] **Step 4: Create `EditorTabs.tsx`**

Create `apps/web/src/components/file-explorer/EditorTabs.tsx`:

```tsx
import { XIcon } from "lucide-react";
import type { EditorTab } from "./useEditorTabs";
import { basenameOfPath } from "../../vscode-icons";

interface EditorTabsProps {
  tabs: readonly EditorTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: (index: number) => void;
}

export function EditorTabs({ tabs, activeIndex, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex h-8 shrink-0 items-center overflow-x-auto border-b border-border bg-card">
      {tabs.map((tab, index) => (
        <button
          key={tab.relativePath}
          type="button"
          onClick={() => onSelect(index)}
          className={`group flex items-center gap-1.5 px-3 h-full text-xs border-r border-border shrink-0 ${
            index === activeIndex
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
          }`}
        >
          <span className="truncate max-w-[120px]">
            {tab.isDirty && <span className="text-yellow-500 mr-0.5">&bull;</span>}
            {basenameOfPath(tab.relativePath)}
          </span>
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onClose(index);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onClose(index);
              }
            }}
            className="size-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-accent"
          >
            <XIcon className="size-3" />
          </span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `EditorBreadcrumb.tsx`**

Create `apps/web/src/components/file-explorer/EditorBreadcrumb.tsx`:

```tsx
import { ChevronRightIcon } from "lucide-react";

interface EditorBreadcrumbProps {
  relativePath: string;
}

export function EditorBreadcrumb({ relativePath }: EditorBreadcrumbProps) {
  const parts = relativePath.split("/");

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 text-xs text-muted-foreground border-b border-border bg-card overflow-x-auto">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5 shrink-0">
          {i > 0 && <ChevronRightIcon className="size-3" />}
          <span className={i === parts.length - 1 ? "text-foreground" : ""}>{part}</span>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create `CodeEditor.tsx`**

Create `apps/web/src/components/file-explorer/CodeEditor.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import type { EnvironmentId } from "@t3tools/contracts";
import { readEnvironmentApi } from "../../environmentApi";
import { useEditorTabs } from "./useEditorTabs";
import { EditorTabs } from "./EditorTabs";
import { EditorBreadcrumb } from "./EditorBreadcrumb";
import { getLanguageExtension } from "./languageExtensions";

interface CodeEditorProps {
  environmentId: EnvironmentId;
  cwd: string;
  activeFilePath: string | null;
  onOpenFile: (relativePath: string) => void;
}

export function CodeEditor({ environmentId, cwd, activeFilePath, onOpenFile }: CodeEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<import("@codemirror/view").EditorView | null>(null);
  const [cmModules, setCmModules] = useState<{
    EditorView: typeof import("@codemirror/view").EditorView;
    EditorState: typeof import("@codemirror/state").EditorState;
    basicSetup: import("@codemirror/state").Extension;
    oneDark: import("@codemirror/state").Extension;
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

    // Save handler
    const saveFile = async () => {
      if (!activeTab.isDirty) return;
      const api = readEnvironmentApi(environmentId);
      if (!api) return;
      try {
        await api.projects.writeFile({
          cwd,
          relativePath: activeTab.relativePath,
          contents: activeTab.currentContent,
        });
        markSaved(activeTab.relativePath, activeTab.currentContent);
      } catch {
        // TODO: toast error
      }
    };

    // Destroy previous view
    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }

    const extensions = [
      basicSetup,
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          markDirty(activeTab.relativePath, update.state.doc.toString());
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

    // Load language extension async
    const langLoader = getLanguageExtension(activeTab.relativePath);

    const state = EditorState.create({
      doc: activeTab.currentContent,
      extensions,
    });

    const view = new EditorView({ state, parent: container });
    editorViewRef.current = view;

    if (langLoader) {
      void langLoader().then((langExt) => {
        view.dispatch({
          effects: import("@codemirror/state")
            .then(({ StateEffect }) =>
              // Use reconfigure compartment pattern or just dispatch
              // For simplicity, reconfigure via state effect
              StateEffect.appendConfig.of(langExt),
            )
            .then((effect) => ({ effects: effect })),
        });
      });
    }

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
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
```

- [ ] **Step 7: Run typecheck and lint**

Run: `bun typecheck && bun lint && bun fmt`
Expected: PASS (or minor fixable lint issues)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/file-explorer/CodeEditor.tsx apps/web/src/components/file-explorer/EditorTabs.tsx apps/web/src/components/file-explorer/EditorBreadcrumb.tsx apps/web/src/components/file-explorer/useEditorTabs.ts apps/web/src/components/file-explorer/languageExtensions.ts
git commit -m "feat(web): add CodeMirror editor with multi-tab support and language detection"
```

---

### Task 9: File Explorer Tab Assembly (Tree + Editor Split)

**Files:**

- Create: `apps/web/src/components/file-explorer/FileExplorer.tsx`
- Modify: `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`

This task wires the FileTree and CodeEditor into a resizable split pane and integrates it into the RightPanel.

- [ ] **Step 1: Install `react-resizable-panels`**

Run:

```bash
cd apps/web && bun add react-resizable-panels
```

- [ ] **Step 2: Create `FileExplorer.tsx`**

Create `apps/web/src/components/file-explorer/FileExplorer.tsx`:

```tsx
import { useCallback, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { DirectoryEntry, EnvironmentId } from "@t3tools/contracts";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";

interface FileExplorerProps {
  environmentId: EnvironmentId;
  cwd: string;
  theme: "light" | "dark";
}

export function FileExplorer({ environmentId, cwd, theme }: FileExplorerProps) {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  const handleSelectFile = useCallback((relativePath: string) => {
    setActiveFilePath(relativePath);
  }, []);

  const handleContextMenu = useCallback((_event: React.MouseEvent, _entry: DirectoryEntry) => {
    // Context menu implementation in Task 10
  }, []);

  return (
    <PanelGroup direction="horizontal" autoSaveId="file-explorer-split" className="flex-1 min-h-0">
      <Panel defaultSize={30} minSize={15} maxSize={50} className="overflow-hidden">
        <FileTree
          environmentId={environmentId}
          cwd={cwd}
          theme={theme}
          onSelectFile={handleSelectFile}
          onContextMenu={handleContextMenu}
        />
      </Panel>
      <PanelResizeHandle className="w-px bg-border hover:bg-accent transition-colors data-[resize-handle-active]:bg-accent" />
      <Panel minSize={30} className="overflow-hidden">
        <CodeEditor
          environmentId={environmentId}
          cwd={cwd}
          activeFilePath={activeFilePath}
          onOpenFile={handleSelectFile}
        />
      </Panel>
    </PanelGroup>
  );
}
```

- [ ] **Step 3: Replace Files tab placeholder in route file**

In `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`, replace the "File explorer coming soon" placeholder:

```tsx
import { lazy, Suspense } from "react";

const FileExplorer = lazy(() =>
  import("../components/file-explorer/FileExplorer").then((m) => ({ default: m.FileExplorer })),
);
```

Replace the files placeholder content in the inline sidebar branch:

```tsx
<div style={{ display: panelTab === "files" ? "contents" : "none" }}>
  <Suspense
    fallback={
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Loading file explorer...
      </div>
    }
  >
    <FileExplorer
      environmentId={threadRef.environmentId}
      cwd={/* need workspace cwd from environment */}
      theme="dark"
    />
  </Suspense>
</div>
```

For the `cwd` value: look up how the existing code gets the workspace root for the current environment. It's typically the project's `cwd` from the store. Use the store selector for the active project's cwd:

```tsx
const projectCwd = useStore((store) => {
  const envState = selectEnvironmentState(store, threadRef.environmentId);
  return envState.projectCwd;
});
```

If `projectCwd` isn't directly available on the env state, check what `GitStatusInput.cwd` uses — typically the same workspace root. Wire this through.

- [ ] **Step 4: Do the same for the sheet branch**

Replace the sheet's files placeholder with the same lazy-loaded `FileExplorer`.

- [ ] **Step 5: Run typecheck, lint, and format**

Run: `bun typecheck && bun lint && bun fmt`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): assemble FileExplorer with tree/editor split pane in RightPanel"
```

---

### Task 10: Context Menus (Tree + Editor)

**Files:**

- Create: `apps/web/src/components/file-explorer/FileTreeContextMenu.tsx`
- Create: `apps/web/src/components/file-explorer/EditorContextMenu.tsx`
- Modify: `apps/web/src/components/file-explorer/FileExplorer.tsx`
- Modify: `apps/web/src/components/file-explorer/FileTree.tsx`

This task adds right-click context menus for the file tree (New File, New Folder, Rename, Delete, Copy Path, Mention in Chat) and the editor selection (Copy, Mention Selection in Chat).

- [ ] **Step 1: Create `FileTreeContextMenu.tsx`**

Create `apps/web/src/components/file-explorer/FileTreeContextMenu.tsx`:

```tsx
import { useCallback, useState, useRef, useEffect } from "react";
import type { DirectoryEntry, EnvironmentId, FilesystemMutationResult } from "@t3tools/contracts";
import { readEnvironmentApi } from "../../environmentApi";

export type TreeContextAction =
  | "newFile"
  | "newFolder"
  | "rename"
  | "delete"
  | "copyPath"
  | "mentionInChat";

interface ContextMenuState {
  x: number;
  y: number;
  entry: DirectoryEntry;
}

interface FileTreeContextMenuProps {
  state: ContextMenuState | null;
  onClose: () => void;
  environmentId: EnvironmentId;
  cwd: string;
  onAction: (action: TreeContextAction, entry: DirectoryEntry) => void;
}

const MENU_ITEMS: { action: TreeContextAction; label: string; dirOnly?: boolean }[] = [
  { action: "newFile", label: "New File", dirOnly: true },
  { action: "newFolder", label: "New Folder", dirOnly: true },
  { action: "rename", label: "Rename" },
  { action: "delete", label: "Delete" },
  { action: "copyPath", label: "Copy Path" },
  { action: "mentionInChat", label: "Mention in Chat" },
];

export function FileTreeContextMenu({
  state,
  onClose,
  environmentId,
  cwd,
  onAction,
}: FileTreeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  const isDir = state.entry.kind === "directory";
  const items = MENU_ITEMS.filter((item) => !item.dirOnly || isDir);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-md"
      style={{ left: state.x, top: state.y }}
    >
      {items.map((item) => (
        <button
          key={item.action}
          type="button"
          className="flex w-full items-center px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => {
            onAction(item.action, state.entry);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire context menu into `FileExplorer.tsx`**

Update `FileExplorer.tsx` to manage context menu state:

```tsx
import { FileTreeContextMenu, type TreeContextAction } from "./FileTreeContextMenu";

// Inside FileExplorer component:
const [contextMenu, setContextMenu] = useState<{
  x: number;
  y: number;
  entry: DirectoryEntry;
} | null>(null);

const handleContextMenu = useCallback((event: React.MouseEvent, entry: DirectoryEntry) => {
  event.preventDefault();
  setContextMenu({ x: event.clientX, y: event.clientY, entry });
}, []);

const handleContextAction = useCallback(
  async (action: TreeContextAction, entry: DirectoryEntry) => {
    const api = readEnvironmentApi(environmentId);
    if (!api) return;

    switch (action) {
      case "newFile": {
        const name = window.prompt("File name:");
        if (!name) return;
        const relativePath = `${entry.relativePath}/${name}`;
        await api.projects.writeFile({ cwd, relativePath, contents: "" });
        setActiveFilePath(relativePath);
        break;
      }
      case "newFolder": {
        const name = window.prompt("Folder name:");
        if (!name) return;
        await api.filesystem.createDirectory({
          cwd,
          relativePath: `${entry.relativePath}/${name}`,
        });
        break;
      }
      case "rename": {
        const newName = window.prompt("New name:", entry.name);
        if (!newName || newName === entry.name) return;
        const parentPath = entry.relativePath.split("/").slice(0, -1).join("/");
        const newRelativePath = parentPath ? `${parentPath}/${newName}` : newName;
        await api.filesystem.rename({
          cwd,
          oldRelativePath: entry.relativePath,
          newRelativePath,
        });
        break;
      }
      case "delete": {
        const confirmed = window.confirm(`Delete ${entry.relativePath}?`);
        if (!confirmed) return;
        await api.filesystem.delete({ cwd, relativePath: entry.relativePath });
        break;
      }
      case "copyPath": {
        await navigator.clipboard.writeText(entry.relativePath);
        break;
      }
      case "mentionInChat": {
        // Implemented in Task 11
        break;
      }
    }
  },
  [environmentId, cwd],
);

// In the JSX, add before the closing </PanelGroup>:
<FileTreeContextMenu
  state={contextMenu}
  onClose={() => setContextMenu(null)}
  environmentId={environmentId}
  cwd={cwd}
  onAction={handleContextAction}
/>;
```

- [ ] **Step 3: Run typecheck, lint, and format**

Run: `bun typecheck && bun lint && bun fmt`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/file-explorer/FileTreeContextMenu.tsx apps/web/src/components/file-explorer/FileExplorer.tsx
git commit -m "feat(web): add file tree context menu with CRUD operations"
```

---

### Task 11: Mention System Extensions

**Files:**

- Modify: `apps/web/src/composer-editor-mentions.ts`
- Modify: `apps/web/src/composer-editor-mentions.test.ts`
- Modify: `apps/web/src/components/file-explorer/FileExplorer.tsx`

This task extends the mention system to support `@filepath:L<start>-L<end>` line-range references.

- [ ] **Step 1: Write failing tests for line-range mentions**

Add to `apps/web/src/composer-editor-mentions.test.ts`:

```ts
describe("line-range mentions", () => {
  it("parses @path:L10-L20 as a mention with lineRange", () => {
    const segments = splitPromptIntoComposerSegments("Check @src/index.ts:L10-L20 here");
    expect(segments).toEqual([
      { type: "text", text: "Check " },
      { type: "mention", path: "src/index.ts", lineRange: { start: 10, end: 20 } },
      { type: "text", text: " here" },
    ]);
  });

  it("parses plain @path without line range", () => {
    const segments = splitPromptIntoComposerSegments("Check @src/index.ts here");
    expect(segments).toEqual([
      { type: "text", text: "Check " },
      { type: "mention", path: "src/index.ts" },
      { type: "text", text: " here" },
    ]);
  });

  it("handles line range at end of string", () => {
    const segments = splitPromptIntoComposerSegments("Look at @src/app.tsx:L1-L5 ");
    expect(segments).toEqual([
      { type: "text", text: "Look at " },
      { type: "mention", path: "src/app.tsx", lineRange: { start: 1, end: 5 } },
      { type: "text", text: " " },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test apps/web/src/composer-editor-mentions.test.ts`
Expected: FAIL — `lineRange` not yet in the mention segment type.

- [ ] **Step 3: Update `ComposerPromptSegment` type**

In `apps/web/src/composer-editor-mentions.ts`, update the mention variant:

```ts
export type MentionLineRange = {
  readonly start: number;
  readonly end: number;
};

export type ComposerPromptSegment =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "mention";
      path: string;
      lineRange?: MentionLineRange | undefined;
    }
  | {
      type: "skill";
      name: string;
    }
  | {
      type: "terminal-context";
      context: TerminalContextDraft | null;
    };
```

- [ ] **Step 4: Update the mention regex**

Update `MENTION_TOKEN_REGEX` to capture an optional `:L<n>-L<n>` suffix:

```ts
const MENTION_TOKEN_REGEX = /(^|\s)@([^\s@]+?)(?::L(\d+)-L(\d+))?(?=\s)/g;
```

- [ ] **Step 5: Update `collectInlineTokenMatches` to extract line ranges**

Update the `InlineTokenMatch` type and mention matching:

```ts
type InlineTokenMatch =
  | {
      type: "mention";
      value: string;
      lineRange?: MentionLineRange;
      start: number;
      end: number;
    }
  | {
      type: "skill";
      value: string;
      start: number;
      end: number;
    };
```

In the mention `matchAll` loop:

```ts
for (const match of text.matchAll(MENTION_TOKEN_REGEX)) {
  const fullMatch = match[0];
  const prefix = match[1] ?? "";
  const path = match[2] ?? "";
  const lineStart = match[3];
  const lineEnd = match[4];
  const matchIndex = match.index ?? 0;
  const start = matchIndex + prefix.length;
  const end = start + fullMatch.length - prefix.length;
  if (path.length > 0) {
    const lineRange =
      lineStart !== undefined && lineEnd !== undefined
        ? { start: Number.parseInt(lineStart, 10), end: Number.parseInt(lineEnd, 10) }
        : undefined;
    matches.push({ type: "mention", value: path, lineRange, start, end });
  }
}
```

- [ ] **Step 6: Update `splitPromptTextIntoComposerSegments` to pass through lineRange**

In the mention branch:

```ts
if (match.type === "mention") {
  segments.push({
    type: "mention",
    path: match.value,
    ...(match.lineRange ? { lineRange: match.lineRange } : {}),
  });
}
```

- [ ] **Step 7: Run tests**

Run: `bun run test apps/web/src/composer-editor-mentions.test.ts`
Expected: PASS

- [ ] **Step 8: Run full test suite, typecheck, and lint**

Run: `bun run test && bun typecheck && bun lint`
Expected: PASS. Verify existing mention tests still pass.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/composer-editor-mentions.ts apps/web/src/composer-editor-mentions.test.ts
git commit -m "feat(web): extend mention system to support @file:L<start>-L<end> line ranges"
```

---

### Task 12: Wire "Mention in Chat" Actions

**Files:**

- Modify: `apps/web/src/components/file-explorer/FileExplorer.tsx`

This task wires the "Mention in Chat" context menu action to insert `@path` mentions, and the "Mention Selection in Chat" editor action to insert `@path:L<start>-L<end>` mentions into the Lexical composer.

- [ ] **Step 1: Research how the composer accepts programmatic mention insertion**

Before implementing, read the Lexical composer component to understand how to programmatically insert text/mentions. Find:

- The Lexical editor ref or command dispatch pattern
- How existing mentions are inserted (e.g., from autocomplete)
- What API is available for external code to trigger insertion

The approach will likely involve dispatching a custom command to the Lexical editor or using a shared store/callback that the composer listens to.

- [ ] **Step 2: Implement the insertion bridge**

Based on findings from Step 1, create the bridge. A common pattern is a zustand store or a ref-based command channel:

```ts
// In a shared location (e.g., apps/web/src/composerInsertionStore.ts)
import { create } from "zustand";

interface ComposerInsertionStore {
  pendingInsert: string | null;
  insertText: (text: string) => void;
  consumeInsert: () => string | null;
}

export const useComposerInsertionStore = create<ComposerInsertionStore>((set, get) => ({
  pendingInsert: null,
  insertText: (text) => set({ pendingInsert: text }),
  consumeInsert: () => {
    const text = get().pendingInsert;
    set({ pendingInsert: null });
    return text;
  },
}));
```

Then in the Lexical composer component, add an effect that watches `pendingInsert` and inserts it into the editor.

- [ ] **Step 3: Wire "Mention in Chat" in FileExplorer context menu**

In `FileExplorer.tsx`, update the `mentionInChat` case:

```ts
case "mentionInChat": {
  useComposerInsertionStore.getState().insertText(` @${entry.relativePath} `);
  break;
}
```

- [ ] **Step 4: Wire "Mention Selection in Chat" in CodeEditor**

Add a context menu handler to the CodeMirror editor that, when the user right-clicks with a selection, offers "Mention Selection in Chat". On click, it reads the selection range and inserts `@path:L<start>-L<end>`:

```ts
const sel = view.state.selection.main;
if (!sel.empty) {
  const startLine = view.state.doc.lineAt(sel.from).number;
  const endLine = view.state.doc.lineAt(sel.to).number;
  useComposerInsertionStore
    .getState()
    .insertText(` @${activeTab.relativePath}:L${startLine}-L${endLine} `);
}
```

- [ ] **Step 5: Run typecheck and lint**

Run: `bun typecheck && bun lint && bun fmt`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): wire mention-in-chat actions from file explorer to composer"
```

---

### Task 13: Final Integration, Polish, and Verification

**Files:**

- Various files across the codebase

This task performs final integration testing, cleanup, and verification.

- [ ] **Step 1: Run the full test suite**

Run: `bun run test`
Expected: All tests PASS.

- [ ] **Step 2: Run typecheck**

Run: `bun typecheck`
Expected: PASS — zero type errors.

- [ ] **Step 3: Run lint and format**

Run: `bun lint && bun fmt`
Expected: PASS — zero lint errors, formatting clean.

- [ ] **Step 4: Delete the old `diffRouteSearch.ts` if not already deleted**

Verify `apps/web/src/diffRouteSearch.ts` has been deleted. If not, delete it and verify no remaining imports.

- [ ] **Step 5: Verify all new exports are in contract index**

Check `packages/contracts/src/index.ts` exports `filesystem.ts` (already does). Verify the new types are accessible:

```ts
import {
  FilesystemReadFileInput,
  FilesystemListDirectoryResult,
  GitFileStatusResult,
  // etc.
} from "@t3tools/contracts";
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and integration verification for file explorer"
```
