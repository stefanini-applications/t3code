/**
 * WorkspaceFileExplorer - Effect service contract for workspace file exploration.
 *
 * Owns workspace-root-relative file reading, directory listing, mutations
 * (rename, delete, createDirectory), and git file status queries.
 *
 * @module WorkspaceFileExplorer
 */
import { Schema, Context } from "effect";
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

export class WorkspaceFileExplorerError extends Schema.TaggedErrorClass<WorkspaceFileExplorerError>()(
  "WorkspaceFileExplorerError",
  {
    cwd: Schema.String,
    relativePath: Schema.optional(Schema.String),
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

/**
 * WorkspaceFileExplorerShape - Service API for workspace file exploration operations.
 */
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

/**
 * WorkspaceFileExplorer - Service tag for workspace file exploration operations.
 */
export class WorkspaceFileExplorer extends Context.Service<
  WorkspaceFileExplorer,
  WorkspaceFileExplorerShape
>()("t3/workspace/Services/WorkspaceFileExplorer") {}
