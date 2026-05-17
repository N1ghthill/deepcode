import { useState, useEffect } from 'react';
import { execFile } from 'node:child_process';
import os from 'node:os';
import { useConfig } from '../contexts/ConfigContext.js';

export interface UseStatusLineReturn {
  lines: string[];
}

export function useStatusLine(): UseStatusLineReturn {
  const config = useConfig();
  const cwd = config.getWorkingDir();
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    execFile('git', ['branch', '--show-current'], { cwd }, (err, stdout) => {
      if (cancelled) return;
      const branch = err ? null : stdout.trim();
      if (!branch) return; // not in a git repo or detached HEAD
      const home = os.homedir();
      const displayCwd = cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
      setLine(`${displayCwd} [${branch}]`);
    });
    return () => { cancelled = true; };
  }, [cwd]);

  return { lines: line ? [line] : [] };
}
