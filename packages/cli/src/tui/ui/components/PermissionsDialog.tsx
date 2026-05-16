import React, { useCallback, useMemo, useState } from "react";
import { Box, Text } from "ink";
import type { PermissionMode } from "@deepcode/shared";
import { theme } from "../semantic-colors.js";
import { useKeypress } from "../hooks/useKeypress.js";
import { RadioButtonSelect, type RadioSelectItem } from "./shared/RadioButtonSelect.js";

/** The five permission keys editable from the dialog. */
export type PermissionKey = "read" | "write" | "gitLocal" | "shell" | "dangerous";

export type PermissionModes = Record<PermissionKey, PermissionMode>;

const PERMISSION_KEYS: readonly PermissionKey[] = [
  "read",
  "write",
  "gitLocal",
  "shell",
  "dangerous",
];

const MODE_CYCLE: readonly PermissionMode[] = ["allow", "ask", "deny"];

const SAVE_VALUE = "__save__";
const CANCEL_VALUE = "__cancel__";

interface PermissionsDialogProps {
  /** Current persisted permission modes. */
  current: PermissionModes;
  /** Persist the edited modes (applied live and written to config). */
  onSave: (modes: PermissionModes) => void;
  /** Close without persisting. */
  onClose: () => void;
}

function nextMode(mode: PermissionMode): PermissionMode {
  const index = MODE_CYCLE.indexOf(mode);
  return MODE_CYCLE[(index + 1) % MODE_CYCLE.length]!;
}

/**
 * Interactive permission-policy editor. Enter on a permission row cycles its
 * mode (allow → ask → deny); "Save changes" persists; Esc / "Cancel" discards.
 * DeepCode-authored (Qwen's permissions dialog was not ported).
 */
export const PermissionsDialog: React.FC<PermissionsDialogProps> = ({
  current,
  onSave,
  onClose,
}) => {
  const [modes, setModes] = useState<PermissionModes>(current);

  const dirty = useMemo(
    () => PERMISSION_KEYS.some((key) => modes[key] !== current[key]),
    [modes, current],
  );

  const items = useMemo<Array<RadioSelectItem<string>>>(() => {
    const rows: Array<RadioSelectItem<string>> = PERMISSION_KEYS.map((key) => ({
      key,
      value: key,
      label: `${key.padEnd(10)} ${modes[key]}`,
    }));
    rows.push({ key: SAVE_VALUE, value: SAVE_VALUE, label: dirty ? "Save changes" : "Save changes (no edits)" });
    rows.push({ key: CANCEL_VALUE, value: CANCEL_VALUE, label: "Cancel" });
    return rows;
  }, [modes, dirty]);

  const handleSelect = useCallback(
    (value: string) => {
      if (value === SAVE_VALUE) {
        onSave(modes);
        return;
      }
      if (value === CANCEL_VALUE) {
        onClose();
        return;
      }
      const key = value as PermissionKey;
      setModes((prev) => ({ ...prev, [key]: nextMode(prev[key]) }));
    },
    [modes, onClose, onSave],
  );

  const handleEscape = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onClose();
      }
    },
    [onClose],
  );
  useKeypress(handleEscape, { isActive: true });

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
        Permission policy
      </Text>
      <RadioButtonSelect items={items} onSelect={handleSelect} isFocused showNumbers={false} />
      <Text color={theme.text.secondary}>
        ↑↓ navigate · Enter cycles allow/ask/deny · Esc cancel
      </Text>
    </Box>
  );
};
