/* eslint-disable no-undef */
import React, { useState, useEffect } from "react";
import { Text } from "ink";
import type { ThemeColors } from "../../themes.js";
import { t } from "../../i18n/index.js";

interface SpinnerProps {
  theme: ThemeColors;
  text?: string;
  type?: "dots" | "line" | "pulse";
}

const SPINNER_FRAMES = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["-", "\\", "|", "/"],
  pulse: ["◐", "◓", "◑", "◒"],
};

export function Spinner({ theme, text = t("spinnerLoading"), type = "dots" }: SpinnerProps) {
  const [frame, setFrame] = useState(0);
  const frames = SPINNER_FRAMES[type];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, [frames.length]);

  return (
    <Text color={theme.warning}>
      {frames[frame]} {text}
    </Text>
  );
}
