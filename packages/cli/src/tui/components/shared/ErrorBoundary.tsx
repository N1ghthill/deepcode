import React from "react";
import { Box, Text, useInput } from "ink";
import type { ThemeColors } from "../../themes.js";
import { t } from "../../i18n/index.js";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  theme: ThemeColors;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundaryClass extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          theme={this.props.theme}
          onReset={this.props.onReset ? this.resetError : undefined}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  theme: ThemeColors;
  onReset?: () => void;
}

function ErrorFallback({ error, theme, onReset }: ErrorFallbackProps) {
  // Handle 'r' key press for reset
  useInput((input) => {
    if (input === "r" || input === "R") {
      onReset?.();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.error} paddingX={1}>
      <Text color={theme.error} bold>
        {t("errorBoundaryTitle")}
      </Text>
      <Text color={theme.fgMuted}>
        {error?.message}
      </Text>
      {onReset && (
        <Text color={theme.primary}>
          {t("errorBoundaryPressRetry")}
        </Text>
      )}
      <Text> </Text>
      <Text color={theme.fgMuted}>
        {t("errorBoundaryContinue")}
      </Text>
      <Text color={theme.fgMuted}>
        {error?.message}
      </Text>
      {onReset && (
        <Text color={theme.primary}>
          {t("errorBoundaryPressRetry")}
        </Text>
      )}
      <Text> </Text>
      <Text color={theme.fgMuted}>
        {t("errorBoundaryContinue")}
      </Text>
    </Box>
  );
}

export const ErrorBoundary = ErrorBoundaryClass;
