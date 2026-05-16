import React, { useCallback, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  CREDENTIAL_FREE_PROVIDERS,
  type ProviderId,
} from "@deepcode/shared";
import { theme } from "../semantic-colors.js";
import { useKeypress } from "../hooks/useKeypress.js";
import { RadioButtonSelect, type RadioSelectItem } from "./shared/RadioButtonSelect.js";

type ProviderDialogPhase = "providers" | "actions" | "apiKey";
type ProviderAction = "apiKey" | "test" | "back" | "close";

export interface ProviderTestResult {
  ok: boolean;
  detail: string;
  latencyMs?: number;
}

interface ProviderDialogProps {
  providers: readonly ProviderId[];
  currentProvider: ProviderId;
  currentModel?: string;
  hasApiKey: (provider: ProviderId) => boolean;
  onSelectProvider: (provider: ProviderId) => void;
  onSaveApiKey: (provider: ProviderId, apiKey: string) => Promise<void>;
  onTestProvider: (provider: ProviderId) => Promise<ProviderTestResult>;
  onClose: () => void;
}

export const ProviderDialog: React.FC<ProviderDialogProps> = ({
  providers,
  currentProvider,
  currentModel,
  hasApiKey,
  onSelectProvider,
  onSaveApiKey,
  onTestProvider,
  onClose,
}) => {
  const [phase, setPhase] = useState<ProviderDialogPhase>("providers");
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(currentProvider);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const providerItems = useMemo<Array<RadioSelectItem<ProviderId>>>(
    () =>
      providers.map((provider) => {
        const current = provider === currentProvider ? "current" : "";
        const credential = CREDENTIAL_FREE_PROVIDERS.has(provider)
          ? "local"
          : hasApiKey(provider)
            ? "key set"
            : "no key";
        return {
          key: provider,
          value: provider,
          label: [provider.padEnd(10), credential, current].filter(Boolean).join("  "),
        };
      }),
    [currentProvider, hasApiKey, providers],
  );

  const actionItems = useMemo<Array<RadioSelectItem<ProviderAction>>>(
    () => [
      {
        key: "apiKey",
        value: "apiKey",
        label: CREDENTIAL_FREE_PROVIDERS.has(selectedProvider)
          ? "Configurar API KEY (opcional)"
          : "Configurar API KEY",
      },
      { key: "test", value: "test", label: "Testar API" },
      { key: "back", value: "back", label: "Voltar aos providers" },
      { key: "close", value: "close", label: "Fechar" },
    ],
    [selectedProvider],
  );

  const selectProvider = useCallback(
    (provider: ProviderId) => {
      setSelectedProvider(provider);
      onSelectProvider(provider);
      setMessage("");
      setPhase("actions");
    },
    [onSelectProvider],
  );

  const saveApiKey = useCallback(async () => {
    const normalized = apiKeyInput.trim();
    if (!normalized) {
      setMessage("Informe uma API key para salvar.");
      return;
    }
    setIsBusy(true);
    setMessage("Salvando API key...");
    try {
      await onSaveApiKey(selectedProvider, normalized);
      setApiKeyInput("");
      setMessage(`API key salva para ${selectedProvider}.`);
      setPhase("actions");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }, [apiKeyInput, onSaveApiKey, selectedProvider]);

  const testProvider = useCallback(async () => {
    setIsBusy(true);
    setMessage(`Testando ${selectedProvider}...`);
    try {
      const result = await onTestProvider(selectedProvider);
      setMessage(
        result.ok
          ? `Ativo: ${result.latencyMs ?? "?"}ms. ${result.detail}`
          : `Falhou: ${result.detail}`,
      );
    } catch (error) {
      setMessage(`Falhou: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }, [onTestProvider, selectedProvider]);

  const selectAction = useCallback(
    (action: ProviderAction) => {
      if (isBusy) return;
      if (action === "apiKey") {
        setApiKeyInput("");
        setMessage("");
        setPhase("apiKey");
        return;
      }
      if (action === "test") {
        void testProvider();
        return;
      }
      if (action === "back") {
        setMessage("");
        setPhase("providers");
        return;
      }
      onClose();
    },
    [isBusy, onClose, testProvider],
  );

  const handleEscape = useCallback(
    (key: { name: string }) => {
      if (key.name !== "escape" || isBusy) return;
      if (phase === "providers") {
        onClose();
        return;
      }
      setMessage("");
      setApiKeyInput("");
      setPhase("providers");
    },
    [isBusy, onClose, phase],
  );
  useKeypress(handleEscape, { isActive: true });

  useInput(
    (input, key) => {
      if (phase !== "apiKey" || isBusy) return;
      if (key.return) {
        void saveApiKey();
        return;
      }
      if (key.backspace || key.delete) {
        setApiKeyInput((prev) => prev.slice(0, -1));
        return;
      }
      if (key.ctrl && input.toLowerCase() === "u") {
        setApiKeyInput("");
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setApiKeyInput((prev) => prev + input);
      }
    },
    { isActive: phase === "apiKey" },
  );

  const footer = phase === "apiKey"
    ? "Enter salva - Ctrl+U limpa - Esc volta"
    : phase === "providers"
      ? "Up/Down provider - Enter seleciona - Esc fecha"
      : "Up/Down acao - Enter executa - Esc volta";

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border.default}
      paddingX={1}
      marginLeft={2}
      marginRight={2}
    >
      <Text bold color={theme.text.accent}>
        Provider
      </Text>
      <Text color={theme.text.secondary}>
        {selectedProvider}
        {currentModel ? ` - ${currentModel}` : " - model unset"}
      </Text>

      {phase === "providers" && (
        <RadioButtonSelect
          items={providerItems}
          onSelect={selectProvider}
          isFocused
          showNumbers={false}
          maxItemsToShow={8}
        />
      )}

      {phase === "actions" && (
        <RadioButtonSelect
          items={actionItems}
          onSelect={selectAction}
          isFocused={!isBusy}
          showNumbers={false}
        />
      )}

      {phase === "apiKey" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.text.primary}>API key para {selectedProvider}</Text>
          <Text color={theme.text.accent}>
            {apiKeyInput.length > 0 ? "*".repeat(apiKeyInput.length) : "(digite a chave)"}
          </Text>
        </Box>
      )}

      {message && (
        <Text color={message.startsWith("Falhou") ? theme.status.error : theme.text.secondary}>
          {message}
        </Text>
      )}
      <Text color={theme.text.secondary}>{footer}</Text>
    </Box>
  );
};
