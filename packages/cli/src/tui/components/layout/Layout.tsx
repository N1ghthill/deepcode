import React from "react";
import { Box } from "ink";

export interface LayoutProps {
  height?: number;
  header: React.ReactNode;
  sidebar: React.ReactNode;
  statusBar: React.ReactNode;
  sidebarVisible?: boolean;
  children: React.ReactNode;
}

export function Layout({
  height,
  header,
  sidebar,
  statusBar,
  sidebarVisible = false,
  children,
}: LayoutProps) {
  return (
    <Box flexDirection="column" flexGrow={1} minHeight={height}>
      {header}

      <Box flexDirection="row" flexGrow={1}>
        <Box flexGrow={1} flexDirection="column">
          {children}
        </Box>

        {sidebarVisible && (
          <Box width={36} flexShrink={0}>
            {sidebar}
          </Box>
        )}
      </Box>

      {statusBar}
    </Box>
  );
}
