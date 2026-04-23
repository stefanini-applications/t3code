import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  FilesystemReadFileInput,
  FilesystemListDirectoryInput,
  FilesystemListDirectoryResult,
  FilesystemRenameInput,
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
