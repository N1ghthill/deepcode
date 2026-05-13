import { useEffect, useRef, useState } from "react";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_FILES = 2000;

export function useFileTree(cwd: string): string[] {
  const [files, setFiles] = useState<string[]>([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let mounted = true;

    async function fetch() {
      try {
        const { stdout } = await execFileAsync(
          "find",
          [".", "-type", "f", "-not", "-path", "*/node_modules/*", "-not", "-path", "*/.git/*", "-not", "-path", "*/dist/*"],
          { cwd, timeout: 5000 },
        );
        if (!mounted) return;
        const allFiles = stdout
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((f) => f.replace(/^\.\//, ""))
          .slice(0, MAX_FILES);
        setFiles(allFiles);
      } catch {
        // Silently ignore find errors
      }
    }

    void fetch();
    return () => { mounted = false; };
  }, [cwd]);

  return files;
}
