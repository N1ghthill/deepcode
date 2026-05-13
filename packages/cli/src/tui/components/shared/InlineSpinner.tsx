import React, { useState, useEffect } from "react";
import { Text } from "ink";
import type { ThemeColors } from "../../themes.js";

interface InlineSpinnerProps {
  theme: ThemeColors;
}

const FRAMES = ["◐", "◓", "◑", "◒"];

export function InlineSpinner({ theme }: InlineSpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % FRAMES.length);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return <Text color={theme.warning}>{FRAMES[frame]}</Text>;
}
