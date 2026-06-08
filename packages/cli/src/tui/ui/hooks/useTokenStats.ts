import { useCallback, useState } from "react";

export interface TokenStats {
  lastPromptTokenCount: number;
  lastOutputTokenCount: number;
  totalPromptTokenCount: number;
  totalOutputTokenCount: number;
}

export interface UseTokenStatsReturn extends TokenStats {
  recordUsage: (inputTokens: number, outputTokens: number) => void;
}

export function useTokenStats(): UseTokenStatsReturn {
  const [lastPromptTokenCount, setLastPromptTokenCount] = useState(0);
  const [lastOutputTokenCount, setLastOutputTokenCount] = useState(0);
  const [totalPromptTokenCount, setTotalPromptTokenCount] = useState(0);
  const [totalOutputTokenCount, setTotalOutputTokenCount] = useState(0);

  const recordUsage = useCallback((inputTokens: number, outputTokens: number) => {
    setLastPromptTokenCount(inputTokens);
    setLastOutputTokenCount(outputTokens);
    setTotalPromptTokenCount((prev) => prev + inputTokens);
    setTotalOutputTokenCount((prev) => prev + outputTokens);
  }, []);

  return {
    lastPromptTokenCount,
    lastOutputTokenCount,
    totalPromptTokenCount,
    totalOutputTokenCount,
    recordUsage,
  };
}
