import { access, realpath } from "node:fs/promises";
import path from "node:path";
import { PathNotAllowedError } from "../errors.js";

export interface PathRules {
  whitelist: string[];
  blacklist: string[];
}

function escapeRegex(input: string): string {
  return input.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(glob: string): RegExp {
  const doubleStar = "__DEEPCODE_DOUBLE_STAR__";
  const escaped = escapeRegex(glob)
    .replace(/\*\*/g, doubleStar)
    .replace(/\*/g, "[^/]*")
    .replaceAll(doubleStar, ".*");
  return new RegExp(`^${escaped}$`);
}

export class PathSecurity {
  private readonly rules: PathRules;

  constructor(
    private readonly worktree: string,
    rules: PathRules,
  ) {
    const home = process.env.HOME ?? "";
    this.rules = {
      whitelist: rules.whitelist.map((rule) => this.expand(rule, home)),
      blacklist: rules.blacklist.map((rule) => this.expand(rule, home)),
    };
  }

  async normalize(inputPath: string): Promise<string> {
    const absolute = path.isAbsolute(inputPath) ? inputPath : path.resolve(this.worktree, inputPath);
    const normalized = path.normalize(absolute);
    const resolved = await this.resolveExistingParent(normalized);
    if (!this.isAllowed(resolved)) {
      throw new PathNotAllowedError(resolved, "It did not match whitelist rules or it matched blacklist rules.");
    }
    return normalized;
  }

  isAllowed(targetPath: string): boolean {
    const candidate = path.normalize(targetPath);
    const blacklisted = this.rules.blacklist.some((rule) => globToRegex(rule).test(candidate));
    if (blacklisted) {
      return false;
    }
    return this.rules.whitelist.some((rule) => globToRegex(rule).test(candidate));
  }

  private expand(rule: string, home: string): string {
    return rule.replaceAll("${WORKTREE}", this.worktree).replaceAll("${HOME}", home);
  }

  private async resolveExistingParent(targetPath: string): Promise<string> {
    let cursor = targetPath;
    while (cursor !== path.dirname(cursor)) {
      try {
        await access(cursor);
        const real = await realpath(cursor);
        if (targetPath === cursor) {
          return real;
        }
        return path.join(real, path.relative(cursor, targetPath));
      } catch {
        cursor = path.dirname(cursor);
      }
    }
    return targetPath;
  }
}
