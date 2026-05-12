import React from "react";
import { Box } from "ink";

export interface LayoutProps {
  height?: number;
  header: React.ReactNode;
  sidebar: React.ReactNode;
  statusBar: React.ReactNode;
  children: React.ReactNode;
}

export function Layout({
  height,
  header,
  sidebar,
  statusBar,
  children,
}: LayoutProps) {
  return (
    <Box flexDirection="column" flexGrow={1} minHeight={height}>
      {header}

      <Box flexDirection="row" flexGrow={1}>
        <Box width="65%" flexDirection="column">
          {children}
        </Box>

        <Box width="35%">
          {sidebar}
        </Box>
      </Box>

      {statusBar}
    </Box>
  );
}
