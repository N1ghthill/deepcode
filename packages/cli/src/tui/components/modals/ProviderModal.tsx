import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ThemeColors } from "../../themes.js";
import type { ProviderId } from "@deepcode/shared";
import {
  getScopedProviderStatus,
  isProviderStatusStale,
  type ProviderStatus,
} from "../../hooks/useProviderStatus.js";
import { InlineSpinner } from "../shared/InlineSpinner.js";

const ESCAPE = String.fromCharCode(27);
const BRACKETED_PASTE_MARKERS = new RegExp(`(?:${ESCAPE})?\\[(?:200|201)~`, "g");

function normalizeSingleLineInput(input: string): string {
  return input.replace(BRACKETED_PASTE_MARKERS, "").replace(/[\r\n]+/g, "");
}

export interface ProviderModalProps {
  theme: ThemeColors;
  currentProvider: ProviderId;
  providers: Array<{
    id: ProviderId;
    name: string;
    status: ProviderStatus;
    hasApiKey: boolean;
    hasApiKeyFile: boolean;
    expectedTarget?: string;
  }>;
  onClose: () => void;
  onTestConnection: (providerId: ProviderId) => Promise<void>;
  onSelectProvider: (providerId: ProviderId) => Promise<void>;
  onUpdateApiKey?: (providerId: ProviderId, apiKey: string) => Promise<void>;
  onUpdateApiKeyFile?: (providerId: ProviderId, apiKeyFile: string) => Promise<void>;
}

export function ProviderModal({
  theme,
  currentProvider,
  providers,
  onClose,
  onTestConnection,
  onSelectProvider,
  onUpdateApiKey,
  onUpdateApiKeyFile,
}: ProviderModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [testing, setTesting] = useState<ProviderId | null>(null);
  const [editingProvider, setEditingProvider] = useState<ProviderId | null>(null);
  const [editField, setEditField] = useState<"apiKey" | "apiKeyFile">("apiKey");
  const [editInput, setEditInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingProvider, setSavingProvider] = useState<ProviderId | null>(null);

  const handleTest = async () => {
    if (savingProvider) return;
    const provider = providers[selectedIndex];
    if (!provider) return;

    setTesting(provider.id);
    await onTestConnection(provider.id);
    setTesting(null);
  };

  const handleSaveEdit = async () => {
    if (!editingProvider || savingProvider) return;

    const providerId = editingProvider;
    setSavingProvider(providerId);
    try {
      if (editField === "apiKey" && onUpdateApiKey) {
        await onUpdateApiKey(providerId, editInput);
      } else if (editField === "apiKeyFile" && onUpdateApiKeyFile) {
        await onUpdateApiKeyFile(providerId, editInput);
      }
      setEditingProvider(null);
      setEditInput("");
      setShowPassword(false);
    } finally {
      setSavingProvider(null);
    }
  };

  useInput((inputChar, key) => {
    if (savingProvider) {
      return;
    }

    // If we're editing an API key
    if (editingProvider) {
      if (key.escape) {
        setEditingProvider(null);
        setEditInput("");
        setShowPassword(false);
      } else if (key.return) {
        void handleSaveEdit();
      } else if (inputChar === "\u0014" || (key.ctrl && inputChar?.toLowerCase() === "t")) {
        setShowPassword(prev => !prev);
      } else if (key.backspace || key.delete) {
        setEditInput(prev => prev.slice(0, -1));
      } else if (inputChar && !key.ctrl && !key.meta) {
        const normalizedInput = normalizeSingleLineInput(inputChar);
        if (normalizedInput) {
          setEditInput(prev => prev + normalizedInput);
        }
      }
      return;
    }

    if (key.escape) {
      onClose();
    } else if (key.return) {
      void handleTest();
    } else if (inputChar === 's' || inputChar === 'S') {
      const provider = providers[selectedIndex];
      if (provider) void onSelectProvider(provider.id);
    } else if (inputChar === 'e' || inputChar === 'E') {
      if (onUpdateApiKey) {
        const provider = providers[selectedIndex];
          if (provider) {
            setEditingProvider(provider.id);
            setEditField("apiKey");
            setEditInput("");
            setShowPassword(false);
          }
      }
    } else if (inputChar === 'f' || inputChar === 'F') {
      if (onUpdateApiKeyFile) {
        const provider = providers[selectedIndex];
        if (provider) {
          setEditingProvider(provider.id);
          setEditField("apiKeyFile");
          setEditInput("");
          setShowPassword(true);
        }
      }
    } else if (key.upArrow) {
      setSelectedIndex((current) => Math.max(0, current - 1));
    } else if (key.downArrow) {
      setSelectedIndex((current) => Math.min(providers.length - 1, current + 1));
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.borderActive}
      paddingX={1}
    >
      <Text bold color={theme.primary}>
        Gerenciar Providers
      </Text>
      <Text color={theme.fgMuted}>
        {editingProvider 
          ? `${editField === "apiKey" ? "Cole ou digite a API key" : "Cole ou digite o caminho do arquivo da API key"} | Enter salvar | Esc cancelar | Ctrl+T visibilidade`
          : "↑/↓ navegar | s usar provider | Enter testar | e API key | f arquivo de key | Esc fechar"}
      </Text>
      <Text> </Text>

      {providers.map((provider, index) => {
        const selected = index === selectedIndex;
        const isTesting = testing === provider.id;
        const isEditing = editingProvider === provider.id;
        const isSaving = savingProvider === provider.id;
        const isCurrent = provider.id === currentProvider;
        const scopedStatus = getScopedProviderStatus(
          provider.status,
          provider.expectedTarget,
        );
        const staleStatus = isProviderStatusStale(
          provider.status,
          provider.expectedTarget,
        );

        return (
          <Box key={provider.id} flexDirection="column">
            <Text
              color={selected ? theme.primary : theme.fgMuted}
              bold={selected}
            >
              {selected ? "▶ " : "  "}
              {provider.name}{" "}
              {isCurrent && <Text color={theme.success}>[ativo] </Text>}
              {scopedStatus?.online ? (
                <Text color={theme.success}>
                  ● conectado ({scopedStatus.latency}ms)
                </Text>
              ) : scopedStatus?.error ? (
                <Text color={theme.error}>
                  ○ erro: {scopedStatus.error.slice(0, 60)}
                </Text>
              ) : staleStatus ? (
                <Text color={theme.fgMuted}>
                  ○ status antigo
                </Text>
              ) : (
                <Text color={theme.fgMuted}>○ não testado</Text>
              )}
              {isTesting && (
                <Text color={theme.warning}>
                  {" "}<InlineSpinner theme={theme} /> testando...
                </Text>
              )}
              {isSaving && (
                <Text color={theme.warning}>
                  {" "}<InlineSpinner theme={theme} /> salvando...
                </Text>
              )}
            </Text>

            {selected && !isEditing && (
              <Box paddingLeft={2} flexDirection="column">
                <Text color={theme.fgMuted}>
                  API Key: {provider.hasApiKey ? "[set]" : "[missing]"}
                </Text>
                <Text color={theme.fgMuted}>
                  API Key file: {provider.hasApiKeyFile ? "[set]" : "[not set]"}
                </Text>
                {provider.expectedTarget && (
                  <Text color={theme.fgMuted}>
                    Target atual: {provider.expectedTarget}
                  </Text>
                )}
                <Text color={theme.fgMuted}>
                  Last checked:{" "}
                  {provider.status.lastChecked
                    ? provider.status.lastChecked.toLocaleTimeString()
                    : "never"}
                </Text>
                {staleStatus && provider.status.checkedTarget && (
                  <Text color={theme.fgMuted}>
                    Ultimo teste: {provider.status.checkedTarget}
                  </Text>
                )}
                {scopedStatus?.error && (
                  <Text color={theme.error}>
                    Erro completo: {scopedStatus.error}
                  </Text>
                )}
                {staleStatus && provider.status.error && (
                  <Text color={theme.fgMuted}>
                    Ultimo erro: {provider.status.error}
                  </Text>
                )}
              </Box>
            )}

            {isEditing && (
              <Box paddingLeft={2} flexDirection="column">
                <Text color={theme.primary}>
                  {editField === "apiKey" ? "Editar API Key:" : "Editar arquivo da API Key:"}
                </Text>
                <Text color={theme.fgMuted}>
                  {editField === "apiKey" && !showPassword
                    ? '•'.repeat(editInput.length) || '[vazio]'
                    : editInput || '[vazio]'}
                </Text>
                <Text color={theme.fgMuted}>
                  {savingProvider === provider.id
                    ? "Salvando credencial..."
                    : "(Ctrl+T: alterna visibilidade)"}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}

      <Text> </Text>
      <Text color={theme.fgMuted}>
        Tudo aqui salva na configuração do app. Segredos não são exibidos depois de salvos.
      </Text>
      <Text color={theme.fgMuted}>
        Arquivo de key permite apontar para um arquivo local fora do repositório.
      </Text>
    </Box>
  );
}
