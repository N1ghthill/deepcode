import { useState, useCallback } from "react";
import type { ProviderId } from "@deepcode/shared";
import { t } from "../i18n/index.js";

export interface ProviderStatus {
  online: boolean;
  latency: number | null;
  error: string | null;
  lastChecked: Date | null;
  checkedTarget: string | null;
}

interface UseProviderStatusResult {
  statuses: Record<ProviderId, ProviderStatus>;
  checkStatus: (providerId: ProviderId, provider: ProviderHealthCheck) => Promise<ProviderStatus>;
  checkAll: (providers: Map<ProviderId, ProviderHealthCheck>) => Promise<void>;
}

interface ProviderHealthCheck {
  validateConfig: (options?: { signal?: AbortSignal }) => Promise<boolean>;
  validateProviderModel?: (options?: { signal?: AbortSignal }) => Promise<unknown>;
  modelUnderTest?: string;
}

export const EMPTY_PROVIDER_STATUS: ProviderStatus = {
  online: false,
  latency: null,
  error: null,
  lastChecked: null,
  checkedTarget: null,
};

export function isProviderStatusCurrent(
  status: ProviderStatus | undefined,
  expectedTarget?: string,
): boolean {
  if (!status?.lastChecked) {
    return false;
  }

  if (!status.checkedTarget) {
    return true;
  }

  return status.checkedTarget === expectedTarget;
}

export function isProviderStatusStale(
  status: ProviderStatus | undefined,
  expectedTarget?: string,
): boolean {
  return Boolean(
    status?.lastChecked &&
    status.checkedTarget &&
    status.checkedTarget !== expectedTarget,
  );
}

export function getScopedProviderStatus(
  status: ProviderStatus | undefined,
  expectedTarget?: string,
): ProviderStatus | undefined {
  return isProviderStatusCurrent(status, expectedTarget) ? status : undefined;
}

export function useProviderStatus(): UseProviderStatusResult {
  const [statuses, setStatuses] = useState<Record<ProviderId, ProviderStatus>>({
    openrouter: { ...EMPTY_PROVIDER_STATUS },
    anthropic: { ...EMPTY_PROVIDER_STATUS },
    openai: { ...EMPTY_PROVIDER_STATUS },
    deepseek: { ...EMPTY_PROVIDER_STATUS },
    opencode: { ...EMPTY_PROVIDER_STATUS },
    groq: { ...EMPTY_PROVIDER_STATUS },
    ollama: { ...EMPTY_PROVIDER_STATUS },
  });

  const checkStatus = useCallback(async (
    providerId: ProviderId,
    provider: ProviderHealthCheck,
  ) => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const valid = await (async () => {
        try {
          return provider.validateProviderModel
            ? Boolean(await provider.validateProviderModel({ signal: controller.signal }))
            : await provider.validateConfig({ signal: controller.signal });
        } finally {
          clearTimeout(timeout);
        }
      })();

      const latency = Date.now() - start;
      const nextStatus: ProviderStatus = valid
        ? {
            online: true,
            latency,
            error: null,
            lastChecked: new Date(),
            checkedTarget: provider.modelUnderTest ?? null,
          }
        : {
            online: false,
            latency,
            error: t("providerConnectionTestFailed"),
            lastChecked: new Date(),
            checkedTarget: provider.modelUnderTest ?? null,
          };

      setStatuses((prev) => ({ ...prev, [providerId]: nextStatus }));
      return nextStatus;
    } catch (err) {
      const latency = Date.now() - start;
      const nextStatus: ProviderStatus = {
        online: false,
        latency,
        error: err instanceof Error ? err.message : t("providerUnknownError"),
        lastChecked: new Date(),
        checkedTarget: provider.modelUnderTest ?? null,
      };
      setStatuses((prev) => ({ ...prev, [providerId]: nextStatus }));
      return nextStatus;
    }
  }, []);

  const checkAll = useCallback(async (
    providers: Map<ProviderId, ProviderHealthCheck>,
  ) => {
    const checks = Array.from(providers.entries()).map(([id, provider]) =>
      checkStatus(id, provider),
    );
    await Promise.all(checks);
  }, [checkStatus]);

  return { statuses, checkStatus, checkAll };
}
