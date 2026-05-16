import { useMemo } from "react";

export function useTokenEstimate(text: string): number {
  return useMemo(() => {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }, [text]);
}
