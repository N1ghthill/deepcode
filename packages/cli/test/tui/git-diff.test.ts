import { describe, it, expect } from "vitest";
import {
  parseGitNumstat,
  parseShortstat,
  parseDeletedFromNameStatus,
} from "../../src/tui/qwen-core/git-diff.js";

/** NUL byte — git's `-z` record separator for numstat / name-status output. */
const NUL = String.fromCharCode(0);

describe("parseShortstat", () => {
  it("parses files, insertions and deletions", () => {
    expect(parseShortstat(" 3 files changed, 12 insertions(+), 4 deletions(-)")).toEqual({
      filesCount: 3,
      linesAdded: 12,
      linesRemoved: 4,
    });
  });

  it("handles a single file with only insertions", () => {
    expect(parseShortstat(" 1 file changed, 5 insertions(+)")).toEqual({
      filesCount: 1,
      linesAdded: 5,
      linesRemoved: 0,
    });
  });

  it("returns null for unrecognized input", () => {
    expect(parseShortstat("not a shortstat line")).toBeNull();
  });
});

describe("parseGitNumstat", () => {
  it("sums per-file added/removed counts", () => {
    const result = parseGitNumstat(`12\t4\tsrc/a.ts${NUL}10\t0\tsrc/b.ts${NUL}`);
    expect(result.stats).toEqual({ filesCount: 2, linesAdded: 22, linesRemoved: 4 });
    expect(result.perFileStats.get("src/a.ts")).toEqual({
      added: 12,
      removed: 4,
      isBinary: false,
    });
  });

  it("marks binary files with dashes", () => {
    const result = parseGitNumstat(`-\t-\timage.png${NUL}`);
    expect(result.perFileStats.get("image.png")).toEqual({
      added: 0,
      removed: 0,
      isBinary: true,
    });
  });

  it("reconstructs renamed paths", () => {
    const result = parseGitNumstat(`3\t1\t${NUL}old.ts${NUL}new.ts${NUL}`);
    expect(result.stats.filesCount).toBe(1);
    expect(result.perFileStats.get("old.ts => new.ts")).toEqual({
      added: 3,
      removed: 1,
      isBinary: false,
    });
  });
});

describe("parseDeletedFromNameStatus", () => {
  it("collects deleted files and skips modified and renamed entries", () => {
    const deleted = parseDeletedFromNameStatus(
      `D${NUL}gone.ts${NUL}M${NUL}kept.ts${NUL}R100${NUL}from.ts${NUL}to.ts${NUL}`,
    );
    expect([...deleted]).toEqual(["gone.ts"]);
  });

  it("returns an empty set for no deletions", () => {
    expect(parseDeletedFromNameStatus(`M${NUL}kept.ts${NUL}`).size).toBe(0);
  });
});
