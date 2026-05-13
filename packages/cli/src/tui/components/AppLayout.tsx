import React, { useEffect } from "react";
import { Box, useInput, useStdout } from "ink";
import { useUIStore, type PanelId } from "../store/ui-store.js";
import type { ThemeColors } from "../themes.js";

interface AppLayoutProps {
  contextPanel: React.ReactNode;
  executionPanel: React.ReactNode;
  detailPanel: React.ReactNode;
  header: React.ReactNode;
  statusBar: React.ReactNode;
  theme?: ThemeColors;
  height?: number;
}

export function AppLayout({
  contextPanel,
  executionPanel,
  detailPanel,
  header,
  statusBar,
  theme,
  height,
}: AppLayoutProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns ?? 120;
  const terminalHeight = height ?? stdout.rows ?? 40;

  const panels = useUIStore((s) => s.panels);
  const activePanel = useUIStore((s) => s.activePanel);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const resizePanel = useUIStore((s) => s.resizePanel);
  const setActivePanel = useUIStore((s) => s.setActivePanel);

  useInput((inputChar, key) => {
    // Panel toggle: Ctrl+1, Ctrl+2, Ctrl+3
    if (key.ctrl && inputChar === "1") { togglePanel("context"); return; }
    if (key.ctrl && inputChar === "2") { togglePanel("execution"); return; }
    if (key.ctrl && inputChar === "3") { togglePanel("detail"); return; }

    // Panel resize: Ctrl+Left / Ctrl+Right
    if (key.ctrl && key.leftArrow) { resizePanel("left"); return; }
    if (key.ctrl && key.rightArrow) { resizePanel("right"); return; }
  });

  // Compute actual pixel widths from percentages
  const visiblePanels = (["context", "execution", "detail"] as PanelId[]).filter(
    (p) => !panels[p].collapsed,
  );

  // Calculate total visible percent
  const totalPct = visiblePanels.reduce((sum, p) => sum + panels[p].widthPercent, 0);

  function panelWidth(id: PanelId): number {
    if (panels[id].collapsed) return 0;
    const pct = panels[id].widthPercent / totalPct;
    return Math.floor(terminalWidth * pct);
  }

  return (
    <Box flexDirection="column" minHeight={terminalHeight}>
      {header}

      <Box flexDirection="row" flexGrow={1}>
        {/* Context Panel */}
        {!panels.context.collapsed && (
          <Box
            width={panelWidth("context")}
            flexShrink={0}
            flexDirection="column"
            borderStyle="round"
            borderColor={activePanel === "context" ? (theme?.borderActive ?? "blue") : (theme?.border ?? undefined)}
          >
            {contextPanel}
          </Box>
        )}

        {/* Execution Panel */}
        {!panels.execution.collapsed && (
          <Box
            flexGrow={1}
            flexDirection="column"
            borderStyle="round"
            borderColor={activePanel === "execution" ? (theme?.borderActive ?? "blue") : (theme?.border ?? undefined)}
          >
            {executionPanel}
          </Box>
        )}

        {/* Detail Panel */}
        {!panels.detail.collapsed && (
          <Box
            width={panelWidth("detail")}
            flexShrink={0}
            flexDirection="column"
            borderStyle="round"
            borderColor={activePanel === "detail" ? (theme?.borderActive ?? "blue") : (theme?.border ?? undefined)}
          >
            {detailPanel}
          </Box>
        )}
      </Box>

      {statusBar}
    </Box>
  );
}
