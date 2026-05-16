import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../themes.js";
import type { GithubOAuthState } from "../app-config.js";

interface OAuthWizardProps {
  state: GithubOAuthState;
  theme: ThemeColors;
}

type Step = 1 | 2 | 3;

function resolveStep(state: GithubOAuthState): Step {
  if (state.status === "opening" || state.status === "idle") return 1;
  if (state.status === "waiting" || state.status === "saving") return 2;
  return 3;
}

function StepIndicator({ step, current, label, theme }: {
  step: Step;
  current: Step;
  label: string;
  theme: ThemeColors;
}) {
  const done = current > step;
  const active = current === step;
  return (
    <Box flexDirection="row" gap={1}>
      <Text
        bold
        backgroundColor={done ? theme.success : active ? theme.primary : undefined}
        color={done || active ? "black" : theme.fgMuted}
      >
        {` ${step} `}
      </Text>
      <Text color={done ? theme.success : active ? theme.fg : theme.fgMuted} bold={active}>
        {label}
      </Text>
      {step < 3 && <Text color={theme.fgMuted}> ──</Text>}
    </Box>
  );
}

export function OAuthWizard({ state, theme }: OAuthWizardProps) {
  const currentStep = resolveStep(state);
  const isError = state.status === "error" || state.status === "cancelled";
  const isSuccess = state.status === "success";
  const borderColor = isError ? theme.error : isSuccess ? theme.success : theme.borderActive;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={borderColor}
      paddingX={2}
      paddingY={1}
      width={60}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={theme.primary}>GitHub OAuth</Text>
      </Box>

      {/* Step indicators */}
      <Box flexDirection="row" gap={1} marginBottom={1}>
        <StepIndicator step={1} current={currentStep} label="Autorizar" theme={theme} />
        <StepIndicator step={2} current={currentStep} label="Aguardar" theme={theme} />
        <StepIndicator step={3} current={currentStep} label="Concluído" theme={theme} />
      </Box>

      {/* Step content */}
      {currentStep === 1 && (
        <Box flexDirection="column" gap={1}>
          <Text color={theme.fg}>Acesse a URL abaixo para autorizar:</Text>
          {state.verificationUri ? (
            <Text color={theme.accent} bold>{state.verificationUri}</Text>
          ) : (
            <Text color={theme.fgMuted}>Gerando URL...</Text>
          )}
          {state.userCode && (
            <Box flexDirection="column">
              <Text color={theme.fgMuted}>Código de verificação:</Text>
              <Text color={theme.warning} bold>{state.userCode}</Text>
            </Box>
          )}
          {state.browserError && (
            <Text color={theme.warning}>
              Não foi possível abrir o browser automaticamente.
            </Text>
          )}
        </Box>
      )}

      {currentStep === 2 && (
        <Box flexDirection="column" gap={1}>
          <Text color={theme.warning}>🔄 Autenticando...</Text>
          {state.userCode && (
            <Text color={theme.fgMuted}>Código: <Text color={theme.warning} bold>{state.userCode}</Text></Text>
          )}
          {state.expiresAt && (
            <Text color={theme.fgMuted} dimColor>Expira em: {state.expiresAt}</Text>
          )}
        </Box>
      )}

      {currentStep === 3 && (
        <Box flexDirection="column" gap={1}>
          {isSuccess ? (
            <Text color={theme.success} bold>✅ Autenticado com sucesso!</Text>
          ) : isError ? (
            <Box flexDirection="column">
              <Text color={theme.error} bold>❌ Falha na autenticação</Text>
              {state.message && <Text color={theme.fgMuted}>{state.message}</Text>}
            </Box>
          ) : null}
        </Box>
      )}

      {state.message && currentStep !== 3 && (
        <Box marginTop={1}>
          <Text color={theme.fgMuted} dimColor>{state.message}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.fgMuted} dimColor>Ctrl+C para cancelar · R para reiniciar</Text>
      </Box>
    </Box>
  );
}
