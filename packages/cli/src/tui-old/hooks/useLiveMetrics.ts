import { useState, useRef, useEffect } from "react";

interface LiveMetricsState {
  liveTokens: { input: number; output: number; cost: number };
  elapsed: number;
}

interface LiveMetricsAccumulator {
  input: number;
  output: number;
  cost: number;
  startedAt: number;
}

export function useLiveMetrics(streaming: boolean) {
  const [liveTokens, setLiveTokens] = useState<LiveMetricsState["liveTokens"]>({ input: 0, output: 0, cost: 0 });
  const [elapsed, setElapsed] = useState(0);
  const liveTokensRef = useRef<LiveMetricsAccumulator>({ input: 0, output: 0, cost: 0, startedAt: 0 });
  const liveIntervalRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);

  useEffect(() => {
    if (!streaming) {
      if (liveIntervalRef.current) {
        globalThis.clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      return;
    }

    liveIntervalRef.current = globalThis.setInterval(() => {
      const acc = liveTokensRef.current;
      if (acc.startedAt > 0) {
        setElapsed(Date.now() - acc.startedAt);
      }
      setLiveTokens({
        input: acc.input,
        output: acc.output,
        cost: acc.cost,
      });
    }, 250);

    return () => {
      if (liveIntervalRef.current) {
        globalThis.clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
  }, [streaming]);

  function resetMetrics(): void {
    liveTokensRef.current = { input: 0, output: 0, cost: 0, startedAt: Date.now() };
    setLiveTokens({ input: 0, output: 0, cost: 0 });
    setElapsed(0);
  }

  function recordTokenUsage(inputTokens: number, outputTokens: number, cost: number): void {
    liveTokensRef.current.input += inputTokens;
    liveTokensRef.current.output += outputTokens;
    liveTokensRef.current.cost += cost;
  }

  return {
    liveTokens,
    elapsed,
    liveTokensRef,
    resetMetrics,
    recordTokenUsage,
  };
}
