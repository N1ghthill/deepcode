import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useTokenEstimate } from "../../src/tui/hooks/useTokenEstimate.js";
import { settleInk } from "../settle-ink.js";

function TokenDisplay({ text }: { text: string }) {
  const tokens = useTokenEstimate(text);
  return React.createElement(Text, null, `tokens:${tokens}`);
}

describe("useTokenEstimate", () => {
  it("returns 0 for empty string", async () => {
    const { lastFrame, unmount } = render(React.createElement(TokenDisplay, { text: "" }));
    try {
      await settleInk();
      expect(lastFrame()).toContain("tokens:0");
    } finally {
      unmount();
    }
  });

  it("estimates tokens for short text", async () => {
    const { lastFrame, unmount } = render(
      React.createElement(TokenDisplay, { text: "Hello world" }),
    );
    try {
      await settleInk();
      expect(lastFrame()).toContain("tokens:3");
    } finally {
      unmount();
    }
  });

  it("estimates tokens for longer text", async () => {
    const { lastFrame, unmount } = render(
      React.createElement(TokenDisplay, { text: "this is a longer text for testing" }),
    );
    try {
      await settleInk();
      expect(lastFrame()).toContain("tokens:9");
    } finally {
      unmount();
    }
  });

  it("rounds up to the nearest whole token", async () => {
    // "abc" has length 3 → Math.ceil(3/4) = 1
    const { lastFrame, unmount } = render(
      React.createElement(TokenDisplay, { text: "abc" }),
    );
    try {
      await settleInk();
      expect(lastFrame()).toContain("tokens:1");
    } finally {
      unmount();
    }
  });
});
