import { Effect, FileSystem, Layer, Path } from "effect";
import { execFile } from "node:child_process";

import {
  WorkspaceFileExplorer,
  WorkspaceFileExplorerError,
  type WorkspaceFileExplorerShape,
} from "../Services/WorkspaceFileExplorer.ts";
import { WorkspaceEntries } from "../Services/WorkspaceEntries.ts";
import { WorkspacePaths } from "../Services/WorkspacePaths.ts";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const BINARY_CHECK_BYTES = 8192;

function hasBinaryContent(buffer: Uint8Array): boolean {
  const limit = Math.min(buffer.length, BINARY_CHECK_BYTES);
  for (let i = 0; i < limit; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

type GitStatusCode = "modified" | "added" | "deleted" | "untracked" | "renamed" | "conflicted";

function parseGitStatusCode(x: string, y: string): GitStatusCode | null {
  if (x === "?" && y === "?") return "untracked";
  if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D"))
    return "conflicted";
  if (x === "R" || y === "R") return "renamed";
  if (x === "A" || y === "A") return "added";
  if (x === "D" || y === "D") return "deleted";
  if (x === "M" || y === "M") return "modified";
  return null;
}

export const makeWorkspaceFileExplorer = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspacePaths = yield* WorkspacePaths;
  const workspaceEntries = yield* WorkspaceEntries;

  const readFile: WorkspaceFileExplorerShape["readFile"] = Effect.fn(
    "WorkspaceFileExplorer.readFile",
  )(function* (input) {
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.relativePath,
    });

    const stat = yield* fileSystem.stat(target.absolutePath).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileExplorerError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "readFile.stat",
            detail: cause.message,
            cause,
          }),
      ),
    );

    if (stat.type !== "File") {
      return yield* new WorkspaceFileExplorerError({
        cwd: input.cwd,
        relativePath: input.relativePath,
        operation: "readFile",
        detail: "Path is not a file",
      });
    }

    if (stat.size > MAX_FILE_SIZE) {
      return yield* new WorkspaceFileExplorerError({
        cwd: input.cwd,
        relativePath: input.relativePath,
        operation: "readFile",
        detail: `File exceeds maximum size of ${MAX_FILE_SIZE} bytes`,
      });
    }

    const bytes = yield* fileSystem.readFile(target.absolutePath).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileExplorerError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "readFile.read",
            detail: cause.message,
            cause,
          }),
      ),
    );

    if (hasBinaryContent(bytes)) {
      const base64 = Buffer.from(bytes).toString("base64");
      return { content: base64, encoding: "base64" as const };
    }

    return { content: new TextDecoder().decode(bytes), encoding: "utf-8" as const };
  });

  const listDirectory: WorkspaceFileExplorerShape["listDirectory"] = Effect.fn(
    "WorkspaceFileExplorer.listDirectory",
  )(function* (input) {
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.relativePath,
    });

    const dirEntries = yield* fileSystem.readDirectory(target.absolutePath).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileExplorerError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "listDirectory.readdir",
            detail: cause.message,
            cause,
          }),
      ),
    );

    // Filter dotfiles, stat each entry to determine kind
    const visibleEntries = dirEntries.filter((name) => !name.startsWith("."));

    const entries = yield* Effect.forEach(
      visibleEntries,
      (name) =>
        fileSystem.stat(path.join(target.absolutePath, name)).pipe(
          Effect.map((stat) => ({
            name,
            kind: (stat.type === "Directory" ? "directory" : "file") as "file" | "directory",
            relativePath: input.relativePath === "." ? name : path.join(input.relativePath, name),
          })),
          Effect.catch(() =>
            Effect.succeed({
              name,
              kind: "file" as const,
              relativePath: input.relativePath === "." ? name : path.join(input.relativePath, name),
            }),
          ),
        ),
      { concurrency: 16 },
    );

    // Sort: directories first, then alphabetical
    const sorted = entries.toSorted((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { entries: sorted };
  });

  const rename: WorkspaceFileExplorerShape["rename"] = Effect.fn("WorkspaceFileExplorer.rename")(
    function* (input) {
      const oldTarget = yield* workspacePaths.resolveRelativePathWithinRoot({
        workspaceRoot: input.cwd,
        relativePath: input.oldRelativePath,
      });
      const newTarget = yield* workspacePaths.resolveRelativePathWithinRoot({
        workspaceRoot: input.cwd,
        relativePath: input.newRelativePath,
      });

      yield* fileSystem
        .makeDirectory(path.dirname(newTarget.absolutePath), { recursive: true })
        .pipe(
          Effect.mapError(
            (cause) =>
              new WorkspaceFileExplorerError({
                cwd: input.cwd,
                relativePath: input.newRelativePath,
                operation: "rename.mkdirParent",
                detail: cause.message,
                cause,
              }),
          ),
        );

      yield* fileSystem.rename(oldTarget.absolutePath, newTarget.absolutePath).pipe(
        Effect.mapError(
          (cause) =>
            new WorkspaceFileExplorerError({
              cwd: input.cwd,
              relativePath: input.oldRelativePath,
              operation: "rename",
              detail: cause.message,
              cause,
            }),
        ),
      );

      yield* workspaceEntries.invalidate(input.cwd);
      return { success: true };
    },
  );

  const deleteOp: WorkspaceFileExplorerShape["delete"] = Effect.fn("WorkspaceFileExplorer.delete")(
    function* (input) {
      const target = yield* workspacePaths.resolveRelativePathWithinRoot({
        workspaceRoot: input.cwd,
        relativePath: input.relativePath,
      });

      yield* fileSystem.remove(target.absolutePath, { recursive: true }).pipe(
        Effect.mapError(
          (cause) =>
            new WorkspaceFileExplorerError({
              cwd: input.cwd,
              relativePath: input.relativePath,
              operation: "delete",
              detail: cause.message,
              cause,
            }),
        ),
      );

      yield* workspaceEntries.invalidate(input.cwd);
      return { success: true };
    },
  );

  const createDirectory: WorkspaceFileExplorerShape["createDirectory"] = Effect.fn(
    "WorkspaceFileExplorer.createDirectory",
  )(function* (input) {
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.relativePath,
    });

    yield* fileSystem.makeDirectory(target.absolutePath, { recursive: true }).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileExplorerError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "createDirectory",
            detail: cause.message,
            cause,
          }),
      ),
    );

    yield* workspaceEntries.invalidate(input.cwd);
    return { success: true };
  });

  const gitFileStatus: WorkspaceFileExplorerShape["gitFileStatus"] = Effect.fn(
    "WorkspaceFileExplorer.gitFileStatus",
  )(function* (cwd) {
    const stdout = yield* Effect.tryPromise({
      try: () =>
        new Promise<string>((resolve, reject) => {
          execFile(
            "git",
            ["status", "--porcelain=v1", "-uall"],
            { cwd, maxBuffer: 10 * 1024 * 1024 },
            (error, stdout) => {
              if (error) reject(error);
              else resolve(stdout);
            },
          );
        }),
      catch: (error) =>
        new WorkspaceFileExplorerError({
          cwd,
          operation: "gitFileStatus",
          detail: error instanceof Error ? error.message : "Failed to run git status",
          cause: error,
        }),
    });

    const files: Array<{ relativePath: string; status: GitStatusCode }> = [];
    for (const line of stdout.split("\n")) {
      if (line.length < 4) continue;
      const x = line[0]!;
      const y = line[1]!;
      const filePath = line.slice(3).split(" -> ").pop()!.trim();
      const status = parseGitStatusCode(x, y);
      if (status !== null && filePath.length > 0) {
        files.push({ relativePath: filePath, status });
      }
    }

    return { files };
  });

  return {
    readFile,
    listDirectory,
    rename,
    delete: deleteOp,
    createDirectory,
    gitFileStatus,
  } satisfies WorkspaceFileExplorerShape;
});

export const WorkspaceFileExplorerLive = Layer.effect(
  WorkspaceFileExplorer,
  makeWorkspaceFileExplorer,
);
