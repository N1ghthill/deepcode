import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { type ModelInfo, type ProviderId } from "@deepcode/shared";
import type { RecentModelSelection } from "../../persistence/ui-state.js";
import type { ThemeColors } from "../../themes.js";
import { formatModelSelection, parseModelSelection, type ModelSelection } from "../../model-selection.js";
import { Spinner } from "../shared/Spinner.js";

const ESCAPE = String.fromCharCode(27);
const BRACKETED_PASTE_MARKERS = new RegExp(`(?:${ESCAPE})?\\[(?:200|201)~`, "g");

function normalizeSingleLineInput(input: string): string {
  return input.replace(BRACKETED_PASTE_MARKERS, "").replace(/[\r\n]+/g, "");
}

interface IndexedModel {
  info: ModelInfo;
  selection: ModelSelection;
  key: string;
}

export interface ModelSelectorProps {
  theme: ThemeColors;
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  currentSelection: ModelSelection | null;
  currentProvider: ProviderId;
  recentSelections: RecentModelSelection[];
  onSelect: (selection: ModelSelection) => void;
  onRefresh: () => void;
  onClose: () => void;
}

export function ModelSelector({
  theme,
  models,
  loading,
  error,
  currentSelection,
  currentProvider,
  recentSelections,
  onSelect,
  onRefresh,
  onClose,
}: ModelSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterText, setFilterText] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualModelId, setManualModelId] = useState(
    currentSelection ? formatModelSelection(currentSelection) : "",
  );
  const [freeOnly, setFreeOnly] = useState(false);

  const currentKey = currentSelection ? formatModelSelection(currentSelection) : "";
  const recentOrder = useMemo(() => {
    const next = new Map<string, number>();
    recentSelections.forEach((selection, index) => {
      next.set(formatModelSelection(selection), index);
    });
    return next;
  }, [recentSelections]);

  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredModels = useMemo(() => {
    const indexed = models.map<IndexedModel>((model) => {
      const selection = { provider: model.provider, model: model.id };
      return {
        info: model,
        selection,
        key: formatModelSelection(selection),
      };
    });

    return indexed
      .filter((model) => {
        const matchesFilter = !normalizedFilter
          ? true
          : (
            model.info.name.toLowerCase().includes(normalizedFilter) ||
            model.info.id.toLowerCase().includes(normalizedFilter) ||
            model.info.provider.toLowerCase().includes(normalizedFilter) ||
            model.key.toLowerCase().includes(normalizedFilter)
          );
        const matchesFree = !freeOnly || isFreeModel(model.info);
        return matchesFilter && matchesFree;
      })
      .sort((left, right) => {
        const leftCurrent = left.key === currentKey ? -1 : 0;
        const rightCurrent = right.key === currentKey ? -1 : 0;
        if (leftCurrent !== rightCurrent) {
          return leftCurrent - rightCurrent;
        }

        const leftRecent = recentOrder.get(left.key);
        const rightRecent = recentOrder.get(right.key);
        if (leftRecent !== undefined || rightRecent !== undefined) {
          if (leftRecent === undefined) return 1;
          if (rightRecent === undefined) return -1;
          return leftRecent - rightRecent;
        }

        const providerOrder = left.info.provider.localeCompare(right.info.provider);
        if (providerOrder !== 0) {
          return providerOrder;
        }

        return `${left.info.name}\u0000${left.info.id}`.localeCompare(`${right.info.name}\u0000${right.info.id}`);
      });
  }, [currentKey, freeOnly, models, normalizedFilter, recentOrder]);

  const clampedSelectedIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, filteredModels.length - 1)));
  const windowSize = 14;
  const windowStart = Math.max(
    0,
    Math.min(
      clampedSelectedIndex - Math.floor(windowSize / 2),
      Math.max(0, filteredModels.length - windowSize),
    ),
  );
  const visibleModels = filteredModels.slice(windowStart, windowStart + windowSize);

  function resetSelection(): void {
    setSelectedIndex(0);
  }

  function confirmSelection(value: string): void {
    const parsed = parseModelSelection(value, currentProvider);
    if (parsed) {
      onSelect(parsed);
    }
  }

  useInput((inputChar, key) => {
    if (isManualEntry) {
      if (key.escape) {
        setIsManualEntry(false);
        setManualModelId("");
      } else if (key.return) {
        confirmSelection(manualModelId);
      } else if (key.backspace || key.delete) {
        setManualModelId((current: string) => current.slice(0, -1));
      } else if (inputChar && !key.ctrl && !key.meta) {
        const normalizedInput = normalizeSingleLineInput(inputChar);
        if (normalizedInput) {
          setManualModelId((current: string) => current + normalizedInput);
        }
      }
      return;
    }

    if (isFiltering) {
      if (key.escape) {
        setIsFiltering(false);
        setFilterText("");
        resetSelection();
      } else if (key.return) {
        const model = filteredModels[clampedSelectedIndex] ?? filteredModels[0];
        if (model) {
          onSelect(model.selection);
        }
        setIsFiltering(false);
      } else if (key.backspace || key.delete) {
        setFilterText((current) => current.slice(0, -1));
        resetSelection();
      } else if (inputChar && !key.ctrl && !key.meta) {
        const normalizedInput = normalizeSingleLineInput(inputChar);
        if (normalizedInput) {
          setFilterText((current) => current + normalizedInput);
          resetSelection();
        }
      }
      return;
    }

    if (key.escape) {
      onClose();
    } else if (key.return) {
      const model = filteredModels[clampedSelectedIndex];
      if (model) {
        onSelect(model.selection);
      }
    } else if (key.upArrow) {
      setSelectedIndex((current) => Math.max(0, current - 1));
    } else if (key.downArrow) {
      setSelectedIndex((current) => Math.min(Math.max(0, filteredModels.length - 1), current + 1));
    } else if (inputChar?.toLowerCase() === "r") {
      onRefresh();
    } else if (inputChar?.toLowerCase() === "f") {
      setFreeOnly((current) => !current);
      resetSelection();
    } else if (inputChar?.toLowerCase() === "m") {
      setIsManualEntry(true);
      setManualModelId(currentSelection ? formatModelSelection(currentSelection) : "");
    } else if (inputChar === "/") {
      setIsFiltering(true);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={theme.borderActive} paddingX={1}>
      <Text bold color={theme.primary}>
        Selecionar Modelo
      </Text>
      <Text color={theme.fgMuted}>
        {isManualEntry
          ? "Modelo manual | Enter usar | Esc cancelar"
          : isFiltering
            ? `Busca: ${filterText} | Enter selecionar | Esc cancelar`
            : "↑/↓ navegar | Enter usar | / buscar | m manual | r refresh | f grátis | Esc fechar"}
      </Text>
      <Text> </Text>

      {loading ? (
        <Box flexDirection="column" gap={1}>
          <Spinner theme={theme} text="Carregando catálogo de modelos" type="dots" />
          <Text color={theme.fgMuted}>Buscando providers configurados...</Text>
        </Box>
      ) : null}

      {error ? (
        <Text color={theme.error}>Erro: {error}</Text>
      ) : null}

      {!loading && !error && isManualEntry ? (
        <Box flexDirection="column">
          <Text color={theme.primary}>Modelo manual</Text>
          <Text>{manualModelId || "[vazio]"}</Text>
          <Text color={theme.fgMuted}>
            Use `provider/model` para trocar provider e modelo em um passo.
          </Text>
        </Box>
      ) : null}

      {!loading && !error && !isManualEntry ? (
        <Box flexDirection="column">
          <Text color={theme.fgMuted}>
            {filteredModels.length} modelos
            {filteredModels.length > 0 ? ` • ${windowStart + 1}-${Math.min(filteredModels.length, windowStart + visibleModels.length)}` : ""}
            {freeOnly ? " • filtro grátis" : ""}
            {recentSelections.length > 0 ? ` • ${recentSelections.length} recentes` : ""}
          </Text>
          <Text> </Text>

          {filteredModels.length === 0 ? (
            <Text color={theme.fgMuted}>
              {normalizedFilter ? `Nenhum modelo encontrado para "${filterText}".` : "Nenhum modelo encontrado."}
            </Text>
          ) : (
            visibleModels.map((entry, index) => {
              const absoluteIndex = windowStart + index;
              const selected = absoluteIndex === clampedSelectedIndex;
              const isCurrent = entry.key === currentKey;
              const isRecent = recentOrder.has(entry.key);
              const free = isFreeModel(entry.info);

              return (
                <Box key={entry.key} flexDirection="column">
                  <Text color={selected ? theme.primary : theme.fgMuted} bold={selected}>
                    {selected ? "▶ " : "  "}
                    {entry.info.provider} / {truncateText(entry.info.name || entry.info.id, 34)}
                    {isCurrent ? <Text color={theme.success}> [atual]</Text> : null}
                    {!isCurrent && isRecent ? <Text color={theme.warning}> [recente]</Text> : null}
                    {free ? <Text color={theme.success}> [free]</Text> : null}
                  </Text>
                  {selected ? (
                    <Text color={theme.fgMuted}>
                      {truncateText(entry.key, 52)} • {formatContext(entry.info.contextLength)} • {formatCapabilities(entry.info)} • {formatModelPricing(entry.info)}
                    </Text>
                  ) : null}
                </Box>
              );
            })
          )}
        </Box>
      ) : null}

      <Text> </Text>
      <Text color={theme.fgMuted}>
        Exemplo: `deepseek/deepseek-chat` ou `openrouter/moonshotai/kimi-k2`
      </Text>
    </Box>
  );
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatContext(contextLength: number): string {
  if (contextLength >= 1_000_000) return `${Math.round(contextLength / 1_000_000)}M ctx`;
  if (contextLength >= 1_000) return `${Math.round(contextLength / 1_000)}k ctx`;
  return `${contextLength} ctx`;
}

function formatCapabilities(model: ModelInfo): string {
  const flags = [
    model.capabilities.functionCalling ? "tools" : null,
    model.capabilities.vision ? "vision" : null,
    model.capabilities.streaming ? "stream" : null,
  ].filter(Boolean);
  return flags.join(", ") || "basic";
}

export function isFreeModel(model: ModelInfo): boolean {
  return Boolean(
    model.pricing &&
      model.pricing.inputPer1k === 0 &&
      model.pricing.outputPer1k === 0,
  );
}

export function formatModelPricing(model: ModelInfo): string {
  if (isFreeModel(model)) {
    return "free";
  }
  if (!model.pricing) {
    return "preço n/d";
  }
  return `$${model.pricing.inputPer1k}/1k in • $${model.pricing.outputPer1k}/1k out`;
}
