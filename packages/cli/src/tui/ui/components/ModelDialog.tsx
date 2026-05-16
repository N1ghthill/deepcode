import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Model, ProviderId } from "@deepcode/shared";
import { theme } from "../semantic-colors.js";

type LoadState = "loading" | "ready" | "error";

export interface ModelDialogProps {
  currentProvider: ProviderId;
  currentModel?: string;
  onFetchModels: (provider: ProviderId, signal: AbortSignal) => Promise<Model[]>;
  onSelectModel: (modelId: string) => void;
  onClose: () => void;
}

type DisplayRow =
  | { type: "header"; label: string }
  | { type: "model"; model: Model; modelIndex: number };

function groupLabel(model: Model): string {
  const slashIdx = model.id.indexOf("/");
  return slashIdx !== -1 ? model.id.slice(0, slashIdx) : model.provider;
}

function isFree(model: Model): boolean {
  return (
    model.pricing !== undefined &&
    model.pricing.inputPer1k === 0 &&
    model.pricing.outputPer1k === 0
  );
}

function buildDisplayRows(models: Model[]): DisplayRow[] {
  const rows: DisplayRow[] = [];
  let lastGroup = "";
  models.forEach((model, modelIndex) => {
    const group = groupLabel(model);
    if (group !== lastGroup) {
      rows.push({ type: "header", label: group });
      lastGroup = group;
    }
    rows.push({ type: "model", model, modelIndex });
  });
  return rows;
}

const MAX_VISIBLE = 14;

export const ModelDialog: React.FC<ModelDialogProps> = ({
  currentProvider,
  currentModel,
  onFetchModels,
  onSelectModel,
  onClose,
}) => {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [models, setModels] = useState<Model[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    onFetchModels(currentProvider, controller.signal)
      .then((fetched) => {
        if (controller.signal.aborted) return;
        setModels(fetched);
        setLoadState("ready");
        const idx = fetched.findIndex((m) => m.id === currentModel);
        if (idx !== -1) setActiveModelIndex(idx);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setLoadState("error");
      });
    return () => controller.abort();
  }, [currentProvider, currentModel, onFetchModels]);

  const filtered = useMemo(() => {
    if (!search) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [models, search]);

  useEffect(() => { setActiveModelIndex(0); }, [search]);

  const clampedIndex = Math.min(activeModelIndex, Math.max(0, filtered.length - 1));
  const displayRows = useMemo(() => buildDisplayRows(filtered), [filtered]);

  // Map activeModelIndex to its position in the display rows (for scroll)
  const activeRowIndex = useMemo(
    () => displayRows.findIndex((r) => r.type === "model" && r.modelIndex === clampedIndex),
    [displayRows, clampedIndex],
  );

  // Scroll offset so the active row stays visible
  const scrollOffset = useMemo(() => {
    if (activeRowIndex < 0) return 0;
    return Math.max(0, Math.min(activeRowIndex - 4, displayRows.length - MAX_VISIBLE));
  }, [activeRowIndex, displayRows.length]);

  const visibleRows = displayRows.slice(scrollOffset, scrollOffset + MAX_VISIBLE);

  const selectCurrent = useCallback(() => {
    const model = filtered[clampedIndex];
    if (!model) return;
    onSelectModel(model.id);
  }, [clampedIndex, filtered, onSelectModel]);

  const moveUp = useCallback(() => {
    setActiveModelIndex((i) => {
      // Skip over headers: find the previous selectable model index
      let candidate = i - 1;
      while (candidate >= 0 && filtered[candidate] === undefined) candidate--;
      return Math.max(0, candidate);
    });
  }, [filtered]);

  const moveDown = useCallback(() => {
    setActiveModelIndex((i) => Math.min(filtered.length - 1, i + 1));
  }, [filtered.length]);

  useInput((input, key) => {
    if (loadState !== "ready") {
      if (key.escape) onClose();
      return;
    }

    if (key.escape) {
      if (search) { setSearch(""); return; }
      onClose();
      return;
    }
    if (key.return) { selectCurrent(); return; }
    if (key.upArrow || (key.ctrl && input === "k")) { moveUp(); return; }
    if (key.downArrow || (key.ctrl && input === "j")) { moveDown(); return; }
    if (key.backspace || key.delete) { setSearch((s) => s.slice(0, -1)); return; }
    if (key.ctrl && input === "u") { setSearch(""); return; }
    if (input && !key.ctrl && !key.meta && input.length === 1) {
      setSearch((s) => s + input);
    }
  }, { isActive: true });

  const hasMore = displayRows.length > MAX_VISIBLE;
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + MAX_VISIBLE < displayRows.length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border.default}
      paddingX={2}
      paddingY={1}
      marginLeft={2}
      marginRight={2}
      minWidth={52}
    >
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color={theme.text.accent}>Select model</Text>
        <Text color={theme.ui.comment} dimColor>esc</Text>
      </Box>

      {/* Provider context */}
      <Box marginBottom={1} gap={1}>
        <Text color={theme.ui.comment}>{currentProvider}</Text>
        {currentModel && (
          <>
            <Text color={theme.ui.comment}>›</Text>
            <Text color={theme.text.secondary}>{currentModel}</Text>
          </>
        )}
      </Box>

      {/* Search field */}
      <Box
        marginBottom={1}
        borderStyle="single"
        borderColor={search ? theme.border.focused : theme.ui.comment}
        paddingX={1}
      >
        <Text color={theme.ui.comment}>⌕ </Text>
        <Text color={theme.text.primary}>
          {search || <Text color={theme.ui.comment} dimColor>search</Text>}
        </Text>
        {search && <Text color={theme.text.accent}>▌</Text>}
      </Box>

      {/* List area */}
      {loadState === "loading" && (
        <Box marginY={1}>
          <Text color={theme.text.secondary}>Loading models…</Text>
        </Box>
      )}

      {loadState === "error" && (
        <Box marginY={1} flexDirection="column" gap={0}>
          <Text color={theme.status.error}>✗ Failed to load models</Text>
          <Text color={theme.ui.comment} dimColor>{errorMsg}</Text>
        </Box>
      )}

      {loadState === "ready" && filtered.length === 0 && (
        <Box marginY={1}>
          <Text color={theme.ui.comment} dimColor>No models match "{search}"</Text>
        </Box>
      )}

      {loadState === "ready" && filtered.length > 0 && (
        <Box flexDirection="column">
          {canScrollUp && (
            <Text color={theme.ui.comment} dimColor>  ↑ more</Text>
          )}

          {visibleRows.map((row, i) => {
            if (row.type === "header") {
              return (
                <Box key={`h-${row.label}-${i}`} marginTop={i === 0 ? 0 : 1}>
                  <Text color={theme.text.accent} bold>{row.label}</Text>
                </Box>
              );
            }

            const { model, modelIndex } = row;
            const isActive = modelIndex === clampedIndex;
            const isCurrent = model.id === currentModel;
            const free = isFree(model);

            return (
              <Box key={model.id} gap={1}>
                <Text color={isActive ? theme.text.accent : theme.ui.comment}>
                  {isCurrent ? "●" : isActive ? "›" : " "}
                </Text>
                <Box flexGrow={1}>
                  <Text
                    color={isActive ? theme.text.primary : theme.text.secondary}
                    bold={isActive || isCurrent}
                  >
                    {model.name}
                  </Text>
                </Box>
                {free && (
                  <Text color={theme.status.success} dimColor={!isActive}>Free</Text>
                )}
              </Box>
            );
          })}

          {canScrollDown && (
            <Text color={theme.ui.comment} dimColor>  ↓ more</Text>
          )}
        </Box>
      )}

      {/* Count */}
      {loadState === "ready" && (
        <Box marginTop={1} gap={1}>
          <Text color={theme.ui.comment} dimColor>
            {filtered.length} model{filtered.length !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : ""}
          </Text>
        </Box>
      )}

      {/* Footer */}
      <Box
        marginTop={1}
        borderStyle="single"
        borderTop
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderColor={theme.ui.comment}
      >
        <Text color={theme.ui.comment} dimColor>
          {loadState === "ready"
            ? "↑↓ navigate  type to search  Enter select  Esc close"
            : "Esc close"}
        </Text>
      </Box>
    </Box>
  );
};
