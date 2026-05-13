import { useInput } from "ink";
import type { DeepCodeRuntime } from "../../runtime.js";
import { useAgentStore } from "../store/agent-store.js";
import { CONFIG_FIELDS } from "../app-config.js";
import { getConfigValue, serializeConfigEditValue } from "../app-utils.js";
import { t } from "../i18n/index.js";

interface UseConfigInputOptions {
  isActive: boolean;
  runtime: DeepCodeRuntime | null;
  configEditIndex: number;
  setConfigEditIndex: (i: number | ((prev: number) => number)) => void;
  editingConfig: boolean;
  setEditingConfig: (v: boolean) => void;
  configEditValue: string;
  setConfigEditValue: (v: string | ((prev: string) => string)) => void;
  onSave: (field: typeof CONFIG_FIELDS[number], value: string) => void;
}

export function useConfigInput({
  isActive,
  runtime,
  configEditIndex,
  setConfigEditIndex,
  editingConfig,
  setEditingConfig,
  configEditValue,
  setConfigEditValue,
  onSave,
}: UseConfigInputOptions) {
  const setViewMode = useAgentStore((s) => s.setViewMode);
  const setVimMode = useAgentStore((s) => s.setVimMode);
  const setNotice = useAgentStore((s) => s.setNotice);

  useInput(
    (inputChar, key) => {
      if (!runtime) return;

      if (editingConfig) {
        const field = CONFIG_FIELDS[configEditIndex];
        if (key.escape) {
          setEditingConfig(false);
          setConfigEditValue("");
          return;
        }
        if (key.return) {
          if (field) onSave(field, configEditValue);
          return;
        }
        if (field?.type === "toggle") {
          if (
            inputChar?.toLowerCase() === "y" ||
            inputChar?.toLowerCase() === "t" ||
            inputChar?.toLowerCase() === "1"
          ) {
            setConfigEditValue("true");
          } else if (
            inputChar?.toLowerCase() === "n" ||
            inputChar?.toLowerCase() === "f" ||
            inputChar?.toLowerCase() === "0"
          ) {
            setConfigEditValue("false");
          }
          return;
        }
        if (key.backspace || key.delete) {
          setConfigEditValue((current) => current.slice(0, -1));
          return;
        }
        if (inputChar && !key.ctrl && !key.meta) {
          setConfigEditValue((current) => current + inputChar);
          return;
        }
        return;
      }

      // Navigation
      if (key.upArrow || inputChar?.toLowerCase() === "k") {
        setConfigEditIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (key.downArrow || inputChar?.toLowerCase() === "j") {
        setConfigEditIndex((current) => Math.min(CONFIG_FIELDS.length - 1, current + 1));
        return;
      }
      if (
        key.return ||
        inputChar?.toLowerCase() === "i" ||
        inputChar?.toLowerCase() === "e"
      ) {
        const field = CONFIG_FIELDS[configEditIndex];
        if (field) {
          const currentValue = getConfigValue(runtime.config, field.key);
          setConfigEditValue(serializeConfigEditValue(currentValue));
          setEditingConfig(true);
          if (inputChar?.toLowerCase() === "i") setVimMode("insert");
        }
        return;
      }
      if (key.escape) {
        setViewMode("chat");
        setVimMode("insert");
        setNotice(t("chatActive"));
        return;
      }
    },
    { isActive },
  );
}
