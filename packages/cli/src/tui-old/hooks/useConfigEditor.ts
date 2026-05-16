import { useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { ConfigLoader } from "@deepcode/core";
import type { DeepCodeRuntime } from "../../runtime.js";
import type { ConfigFieldDef } from "../app-config.js";
import { getConfigValue, parseConfigEditValue, syncLegacyDefaultModel } from "../app-utils.js";
import { t, setLanguage } from "../i18n/index.js";

interface UseConfigEditorOptions {
  cwd: string;
  configPath?: string;
  applyUpdatedConfig: (activeRuntime: DeepCodeRuntime, updatedConfig: DeepCodeRuntime["config"]) => void;
}

interface UseConfigEditorReturn {
  configEditIndex: number;
  setConfigEditIndex: Dispatch<SetStateAction<number>>;
  configEditValue: string;
  setConfigEditValue: Dispatch<SetStateAction<string>>;
  editingConfig: boolean;
  setEditingConfig: Dispatch<SetStateAction<boolean>>;
  configSaveStatus: string | null;
  saveConfigEdit: (activeRuntime: DeepCodeRuntime, field: ConfigFieldDef, value: string) => Promise<void>;
  saveConfigPatch: (activeRuntime: DeepCodeRuntime, mutate: (mutable: Record<string, unknown>) => void) => Promise<DeepCodeRuntime["config"]>;
  resetEditor: () => void;
}

export function useConfigEditor({ cwd, configPath, applyUpdatedConfig }: UseConfigEditorOptions): UseConfigEditorReturn {
  const [configEditIndex, setConfigEditIndex] = useState(0);
  const [configEditValue, setConfigEditValue] = useState("");
  const [editingConfig, setEditingConfig] = useState(false);
  const [configSaveStatus, setConfigSaveStatus] = useState<string | null>(null);

  const saveConfigEdit = useCallback(async (
    activeRuntime: DeepCodeRuntime,
    field: ConfigFieldDef,
    value: string,
  ) => {
    try {
      const loader = new ConfigLoader();
      const fileConfig = await loader.loadFile({ cwd, configPath });
      const currentValue = getConfigValue(fileConfig, field.key);

      let parsed = parseConfigEditValue(value, currentValue, field.type);
      if (field.type === "number") {
        if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
          setConfigSaveStatus(t("invalidValue"));
          setEditingConfig(false);
          return;
        }
      }

      const keys = field.key.split(".");
      const mutable = JSON.parse(JSON.stringify(fileConfig)) as Record<string, unknown>;
      let obj: Record<string, unknown> = mutable;
      for (let i = 0; i < keys.length - 1; i += 1) {
        const key = keys[i];
        if (key) {
          if (!(key in obj) || typeof obj[key] !== "object" || obj[key] === null) {
            obj[key] = {};
          }
          obj = obj[key] as Record<string, unknown>;
        }
      }
      const lastKey = keys[keys.length - 1];
      if (lastKey) {
        if (
          field.key.startsWith("defaultModels.")
          && typeof parsed === "string"
          && parsed.trim().length === 0
        ) {
          delete obj[lastKey];
        } else if (
          field.key.startsWith("agentPermissions.")
          && typeof parsed === "string"
          && parsed.trim().length === 0
        ) {
          delete obj[lastKey];
        } else {
          obj[lastKey] = parsed;
        }
      }

      if (field.key === "defaultProvider" || field.key.startsWith("defaultModels.")) {
        syncLegacyDefaultModel(mutable);
      }

      if (field.key === "tui.language" && typeof parsed === "string") {
        if (parsed === "en" || parsed === "pt-BR") {
          setLanguage(parsed);
        } else {
          setConfigSaveStatus(t("invalidValue"));
          setEditingConfig(false);
          return;
        }
      }

      await loader.save({ cwd, configPath }, mutable as any);

      const updatedConfig = await loader.load({ cwd, configPath });
      applyUpdatedConfig(activeRuntime, updatedConfig);

      setConfigSaveStatus(t("labelUpdated", { label: field.label }));
      setEditingConfig(false);
      setConfigEditValue("");
      setTimeout(() => setConfigSaveStatus(null), 3000);
    } catch (err) {
      setConfigSaveStatus(`${t("configError")}: ${err instanceof Error ? err.message : String(err)}`);
      setEditingConfig(false);
    }
  }, [cwd, configPath, applyUpdatedConfig]);

  const saveConfigPatch = useCallback(async (
    activeRuntime: DeepCodeRuntime,
    mutate: (mutable: Record<string, unknown>) => void,
  ): Promise<DeepCodeRuntime["config"]> => {
    const loader = new ConfigLoader();
    const loadOptions = { cwd, configPath };
    const fileConfig = await loader.loadFile(loadOptions);
    const mutable = JSON.parse(JSON.stringify(fileConfig)) as Record<string, unknown>;
    mutate(mutable);
    await loader.save(loadOptions, mutable as any);
    const updatedConfig = await loader.load(loadOptions);
    applyUpdatedConfig(activeRuntime, updatedConfig);
    return updatedConfig;
  }, [cwd, configPath, applyUpdatedConfig]);

  const resetEditor = useCallback(() => {
    setConfigEditIndex(0);
    setEditingConfig(false);
    setConfigEditValue("");
    setConfigSaveStatus(null);
  }, []);

  return {
    configEditIndex,
    setConfigEditIndex,
    configEditValue,
    setConfigEditValue,
    editingConfig,
    setEditingConfig,
    configSaveStatus,
    saveConfigEdit,
    saveConfigPatch,
    resetEditor,
  };
}
