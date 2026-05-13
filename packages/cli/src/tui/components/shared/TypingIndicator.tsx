import React, { useState, useEffect } from "react";
import { Text } from "ink";
import type { ThemeColors } from "../../themes.js";

interface TypingIndicatorProps {
  theme: ThemeColors;
}

export function TypingIndicator({ theme }: TypingIndicatorProps) {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setDots((prev) => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color={theme.primary}>
      {"●".repeat(dots)}{"○".repeat(3 - dots)}
    </Text>
  );
}
