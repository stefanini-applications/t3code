import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

const FILESYSTEM_PATH_MAX_LENGTH = 512;

export const FilesystemBrowseInput = Schema.Struct({
  partialPath: TrimmedNonEmptyString.check(Schema.isMaxLength(FILESYSTEM_PATH_MAX_LENGTH)),
  cwd: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(FILESYSTEM_PATH_MAX_LENGTH))),
});
export type FilesystemBrowseInput = typeof FilesystemBrowseInput.Type;

export const FilesystemBrowseEntry = Schema.Struct({
  name: TrimmedNonEmptyString,
  fullPath: TrimmedNonEmptyString,
});
export type FilesystemBrowseEntry = typeof FilesystemBrowseEntry.Type;

export const FilesystemBrowseResult = Schema.Struct({
  parentPath: TrimmedNonEmptyString,
  entries: Schema.Array(FilesystemBrowseEntry),
});
export type FilesystemBrowseResult = typeof FilesystemBrowseResult.Type;

export class FilesystemBrowseError extends Schema.TaggedErrorClass<FilesystemBrowseError>()(
  "FilesystemBrowseError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect),
  },
) {}

// --- File Explorer RPCs ---

export const FilesystemReadFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(FILESYSTEM_PATH_MAX_LENGTH)),
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
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(FILESYSTEM_PATH_MAX_LENGTH)),
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
  oldRelativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(FILESYSTEM_PATH_MAX_LENGTH)),
  newRelativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(FILESYSTEM_PATH_MAX_LENGTH)),
});
export type FilesystemRenameInput = typeof FilesystemRenameInput.Type;

export const FilesystemDeleteInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(FILESYSTEM_PATH_MAX_LENGTH)),
});
export type FilesystemDeleteInput = typeof FilesystemDeleteInput.Type;

export const FilesystemCreateDirectoryInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(FILESYSTEM_PATH_MAX_LENGTH)),
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
