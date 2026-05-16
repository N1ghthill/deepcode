import { useEffect, useState } from "react";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitStatusResult {
  branch: string;
  status: string;
  isDirty: boolean;
}

const EMPTY: GitStatusResult = { branch: "", status: "", isDirty: false };

export function useGitStatus(cwd: string): GitStatusResult {
  const [result, setResult] = useState<GitStatusResult>(EMPTY);

  useEffect(() => {
    let mounted = true;

    async function fetch() {
      try {
        const [branchResult, statusResult] = await Promise.allSettled([
          execFileAsync("git", ["branch", "--show-current"], { cwd }),
          execFileAsync("git", ["status", "--porcelain"], { cwd }),
        ]);

        if (!mounted) return;

        const branch = branchResult.status === "fulfilled" ? branchResult.value.stdout.trim() : "";
        const porcelain = statusResult.status === "fulfilled" ? statusResult.value.stdout.trim() : "";
        const isDirty = porcelain.length > 0;
        const changedFiles = porcelain ? porcelain.split("\n").length : 0;
        const status = isDirty ? `~${changedFiles}` : "clean";

        setResult({ branch, status, isDirty });
      } catch {
        // Not a git repo or git not installed — ignore
      }
    }

    void fetch();

    // Refresh every 30s
    const timer = setInterval(() => void fetch(), 30_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [cwd]);

  return result;
}
