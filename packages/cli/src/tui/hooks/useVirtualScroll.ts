import { useState, useCallback, useRef, useEffect } from "react";
import { useInput } from "ink";

export interface VirtualScrollResult<T> {
  visibleItems: T[];
  canScrollUp: boolean;
  canScrollDown: boolean;
  scrollUp: () => void;
  scrollDown: () => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

export function useVirtualScroll<T>(
  items: T[],
  viewportHeight: number,
  estimateHeight: (item: T) => number,
  isActive = true,
  vimMode?: "insert" | "normal",
): VirtualScrollResult<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const autoScrollRef = useRef(true);
  const prevLengthRef = useRef(items.length);
  const ggPendingRef = useRef(false);
  const ggTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (items.length > prevLengthRef.current && autoScrollRef.current) {
      setScrollTop(items.length);
    }
    prevLengthRef.current = items.length;
  }, [items.length]);

  const scrollUp = useCallback(() => {
    autoScrollRef.current = false;
    setScrollTop((prev) => Math.max(0, prev - 1));
  }, []);

  const scrollDown = useCallback(() => {
    setScrollTop((prev) => {
      const next = prev + 1;
      if (next >= items.length) autoScrollRef.current = true;
      return next;
    });
  }, [items.length]);

  const scrollToTop = useCallback(() => {
    autoScrollRef.current = false;
    setScrollTop(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    autoScrollRef.current = true;
    setScrollTop(items.length);
  }, [items.length]);

  const halfPage = Math.max(1, Math.floor(viewportHeight / 4));

  useInput(
    (inputChar, key) => {
      if (key.pageUp || (key.ctrl && key.upArrow)) { scrollUp(); return; }
      if (key.pageDown || (key.ctrl && key.downArrow)) { scrollDown(); return; }

      if (vimMode !== "normal") return;

      if (inputChar === "j") { scrollDown(); return; }
      if (inputChar === "k") { scrollUp(); return; }
      if (inputChar === "G") { scrollToBottom(); return; }
      if (key.ctrl && inputChar === "d") {
        setScrollTop((prev) => Math.min(items.length, prev + halfPage));
        return;
      }
      if (key.ctrl && inputChar === "u") {
        autoScrollRef.current = false;
        setScrollTop((prev) => Math.max(0, prev - halfPage));
        return;
      }
      if (inputChar === "g") {
        if (ggPendingRef.current) {
          if (ggTimerRef.current) clearTimeout(ggTimerRef.current);
          ggPendingRef.current = false;
          scrollToTop();
        } else {
          ggPendingRef.current = true;
          ggTimerRef.current = setTimeout(() => { ggPendingRef.current = false; }, 400);
        }
      }
    },
    { isActive },
  );

  // Calculate visible window working backwards from scrollTop
  const safeScrollTop = Math.min(scrollTop, items.length);
  let height = 0;
  let startIndex = safeScrollTop;

  for (let i = safeScrollTop - 1; i >= 0; i--) {
    const itemHeight = estimateHeight(items[i]!);
    if (height + itemHeight > viewportHeight) break;
    height += itemHeight;
    startIndex = i;
  }

  const visibleItems = items.slice(startIndex, safeScrollTop === items.length ? undefined : safeScrollTop);
  const canScrollUp = startIndex > 0;
  const canScrollDown = safeScrollTop < items.length;

  return { visibleItems, canScrollUp, canScrollDown, scrollUp, scrollDown, scrollToTop, scrollToBottom };
}
