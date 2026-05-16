import { useState, useEffect, useCallback, useRef } from "react";
import type { TelemetryCollector, SessionStats } from "@deepcode/core";

interface UseTelemetryResult {
  stats: SessionStats | null;
  allStats: SessionStats[];
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  toolCalls: number;
  errorCount: number;
  duration: number;
  toolBreakdown: Record<string, number>;
  refresh: () => void;
}

export function useTelemetry(
  sessionId: string,
  collector: TelemetryCollector | null,
): UseTelemetryResult {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [tick, setTick] = useState(0);
  const collectorRef = useRef(collector);

  useEffect(() => {
    collectorRef.current = collector;
  }, [collector]);

  const [toolBreakdown, setToolBreakdown] = useState<Record<string, number>>({});
  const [allStats, setAllStats] = useState<SessionStats[]>([]);

  const refresh = useCallback(() => {
    const currentCollector = collectorRef.current;
    if (!currentCollector || !sessionId) {
      setStats(null);
      setToolBreakdown({});
      return;
    }

    try {
      const sessionStats = currentCollector.getSessionStats(sessionId);
      setStats(sessionStats);
      setToolBreakdown(currentCollector.getSessionToolBreakdown(sessionId));
      setAllStats(currentCollector.getAllSessionStats());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Telemetry refresh failed for session ${sessionId}: ${message}`);
      setStats(null);
      setToolBreakdown({});
    }
  }, [sessionId, tick]);

  useEffect(() => {
    let cancelled = false;

    refresh();

    const interval = globalThis.setInterval(() => {
      if (!cancelled) {
        setTick((t) => t + 1);
      }
    }, 2000);

    return () => {
      cancelled = true;
      globalThis.clearInterval(interval);
    };
  }, [refresh]);

  return {
    stats,
    allStats,
    inputTokens: stats?.inputTokens ?? 0,
    outputTokens: stats?.outputTokens ?? 0,
    estimatedCost: stats?.estimatedCost ?? 0,
    toolCalls: stats?.toolCalls ?? 0,
    errorCount: stats?.errorCount ?? 0,
    duration: stats?.duration ?? 0,
    toolBreakdown,
    refresh,
  };
}
