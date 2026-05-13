import { useState, useCallback, useRef, useEffect } from "react";
import { useInput } from "ink";

export interface VirtualScrollResult<T> {
  visibleItems: T[];
  canScrollUp: boolean;
  canScrollDown: boolean;
  scrollUp: () => void;
  scrollDown: () => void;
  scrollToBottom: () => void;
}

/**
 * Computes a visible window over a list of items for terminal virtual scrolling.
 * Scroll managed via Page Up / Page Down key bindings.
 */
export function useVirtualScroll<T>(
  items: T[],
  viewportHeight: number,
  estimateHeight: (item: T) => number,
  isActive = true,
): VirtualScrollResult<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const autoScrollRef = useRef(true);
  const prevLengthRef = useRef(items.length);

  // Auto-scroll to bottom when new items arrive, unless user scrolled up
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
      if (next >= items.length) {
        autoScrollRef.current = true;
      }
      return next;
    });
  }, [items.length]);

  const scrollToBottom = useCallback(() => {
    autoScrollRef.current = true;
    setScrollTop(items.length);
  }, [items.length]);

  useInput(
    (_input, key) => {
      if (key.pageUp) scrollUp();
      if (key.pageDown) scrollDown();
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

  return { visibleItems, canScrollUp, canScrollDown, scrollUp, scrollDown, scrollToBottom };
}
