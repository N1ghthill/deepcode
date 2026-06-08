import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { HistoryItemWithoutId } from "../types.js";
import { findLastSafeSplitPoint } from "../../utils/markdownUtilities.js";

export interface StreamingTextReturn {
  /** Live text in the in-flight streaming area (pending assistant text). */
  pendingText: string;
  setPendingText: React.Dispatch<React.SetStateAction<string>>;
  /** Tracks cumulative streamed bytes for Composer's streaming indicator. */
  streamingResponseLengthRef: RefObject<number>;
  /** True once onChunk fires for the current run. */
  streamingWasUsedRef: RefObject<boolean>;
  /** Append a new chunk to the pending buffer and mark streaming as active. */
  appendChunk: (text: string) => void;
  /**
   * Commit any buffered text to history and clear the text refs.
   * Returns wasStreaming (the value of streamingWasUsedRef before clearing).
   *
   * Does NOT reset streamingWasUsedRef — callers decide whether and when to
   * reset it (onIteration and finally reset it; onToolsComplete does not).
   * Does NOT call setPendingText — callers control timing relative to awaits
   * so that pending-text clears can batch with appendTurnItems in one render.
   */
  flush: () => boolean;
  /**
   * Full reset for run-start and finally: clears text refs, resets
   * streamingWasUsedRef, calls setPendingText(""), and resets
   * streamingResponseLengthRef to 0.
   *
   * Note: in the finally path, streamingResponseLengthRef should NOT be reset
   * to 0 (it holds the run's total for Composer display until the next run).
   * Use flushRefs() + setPendingText("") in finally instead, or rely on the
   * fact that reset() is only called at run-start.
   */
  reset: () => void;
}

export function useStreamingText(
  addHistoryItem: (item: HistoryItemWithoutId, ts: number) => void,
): StreamingTextReturn {
  // Ref-wrap the callback so the 40ms interval never captures a stale closure.
  const addItemRef = useRef(addHistoryItem);
  addItemRef.current = addHistoryItem;

  const [pendingText, setPendingText] = useState("");
  const fullStreamingTextRef = useRef("");
  const pendingTextBufferRef = useRef("");
  const streamingWasUsedRef = useRef(false);
  const streamingResponseLengthRef = useRef(0);

  // 40ms ≈ 25fps: progressive paragraph commits to Static.
  // Reads pending buffer, appends to full text, finds a safe markdown split
  // point (paragraph break outside code fences), commits completed portions
  // to Static immediately, leaves the current paragraph in the live area.
  useEffect(() => {
    const id = setInterval(() => {
      const newChunk = pendingTextBufferRef.current;
      if (!newChunk) return;
      pendingTextBufferRef.current = "";

      fullStreamingTextRef.current += newChunk;
      const fullText = fullStreamingTextRef.current;
      const splitPoint = findLastSafeSplitPoint(fullText);
      if (splitPoint < fullText.length) {
        const beforeText = fullText.substring(0, splitPoint);
        const afterText = fullText.substring(splitPoint);
        if (beforeText.trim().length > 0) {
          addItemRef.current({ type: "gemini", text: beforeText.trimEnd() }, Date.now());
        }
        fullStreamingTextRef.current = afterText;
        setPendingText(afterText);
      } else {
        setPendingText(fullText);
      }
    }, 40);
    return () => clearInterval(id);
  }, []);

  const appendChunk = useCallback((text: string) => {
    streamingResponseLengthRef.current += text.length;
    pendingTextBufferRef.current += text;
    streamingWasUsedRef.current = true;
  }, []);

  const flush = useCallback((): boolean => {
    const wasStreaming = streamingWasUsedRef.current;
    const finalText = fullStreamingTextRef.current.trim();
    if (wasStreaming && finalText) {
      addItemRef.current({ type: "gemini", text: finalText }, Date.now());
    }
    fullStreamingTextRef.current = "";
    pendingTextBufferRef.current = "";
    return wasStreaming;
  }, []);

  const reset = useCallback(() => {
    fullStreamingTextRef.current = "";
    streamingWasUsedRef.current = false;
    pendingTextBufferRef.current = "";
    streamingResponseLengthRef.current = 0;
    setPendingText("");
  }, []);

  return {
    pendingText,
    setPendingText,
    streamingResponseLengthRef,
    streamingWasUsedRef,
    appendChunk,
    flush,
    reset,
  };
}
