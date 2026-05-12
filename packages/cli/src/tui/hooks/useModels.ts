import { useState, useEffect, useCallback, useRef } from "react";
import type { ModelInfo, ProviderId } from "@deepcode/shared";

interface UseModelsResult {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refresh: () => void; // Limpa cache e refetch
  lastUpdated: Date | null;
}

interface ModelCacheEntry {
  models: ModelInfo[];
  timestamp: number;
}

const modelCache = new Map<string, ModelCacheEntry>();
const CACHE_TTL = 3600 * 1000;
const MAX_CACHE_SIZE = 50;

function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of modelCache.entries()) {
    if (now - entry.timestamp >= CACHE_TTL) {
      modelCache.delete(key);
    }
  }
  while (modelCache.size > MAX_CACHE_SIZE) {
    const oldestKey = modelCache.keys().next().value as string | undefined;
    if (oldestKey) {
      modelCache.delete(oldestKey);
    } else {
      break;
    }
  }
}

interface ModelProvider {
  listModels: (options?: { signal?: AbortSignal }) => Promise<ModelInfo[]>;
}

export interface ModelCatalogProviderEntry {
  id: ProviderId;
  provider: ModelProvider | null;
  enabled: boolean;
}

interface UseModelCatalogResult {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  providerErrors: Partial<Record<ProviderId, string>>;
  refresh: () => void;
  lastUpdated: Date | null;
}

export function useModels(providerId: ProviderId, provider: ModelProvider | null): UseModelsResult {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const fetchModels = useCallback(async () => {
    if (!provider) {
      if (mountedRef.current) {
        setError("Provider not available");
      }
      return;
    }

    const cacheKey = providerId;
    const cached = modelCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      if (mountedRef.current) {
        setModels(cached.models);
        setLastUpdated(new Date(cached.timestamp));
      }
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const fetchedModels = await provider.listModels({ signal: controller.signal });

      if (!mountedRef.current) return;

      const modelInfos: ModelInfo[] = fetchedModels.map((m) => ({
        id: m.id,
        name: m.name,
        provider: providerId,
        contextLength: m.contextLength,
        capabilities: m.capabilities,
        pricing: m.pricing,
      }));

      modelCache.set(cacheKey, { models: modelInfos, timestamp: Date.now() });
      cleanupExpiredCache();
      setModels(modelInfos);
      setLastUpdated(new Date());
    } catch (err) {
      if (!mountedRef.current) return;
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort) {
        setError("Request timed out");
      } else {
        setError(err instanceof Error ? err.message : "Failed to fetch models");
      }
    } finally {
      clearTimeout(timeout);
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [providerId, provider]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchModels();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchModels]);

  const refresh = useCallback(() => {
    modelCache.delete(providerId);
    void fetchModels();
  }, [providerId, fetchModels]);

  return { models, loading, error, refetch: fetchModels, refresh, lastUpdated };
}

export function useModelCatalog(entries: ModelCatalogProviderEntry[]): UseModelCatalogResult {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerErrors, setProviderErrors] = useState<Partial<Record<ProviderId, string>>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const fetchCatalog = useCallback(async () => {
    const enabledEntries = entries.filter((entry) => entry.enabled && entry.provider);
    if (enabledEntries.length === 0) {
      if (mountedRef.current) {
        setModels([]);
        setProviderErrors({});
        setError("Nenhum provider configurado com credencial.");
        setLastUpdated(null);
        setLoading(false);
      }
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    const aggregated: ModelInfo[] = [];
    const nextErrors: Partial<Record<ProviderId, string>> = {};
    let newestTimestamp = 0;

    await Promise.all(
      enabledEntries.map(async (entry) => {
        const cacheKey = entry.id;
        const cached = modelCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          aggregated.push(...cached.models);
          newestTimestamp = Math.max(newestTimestamp, cached.timestamp);
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
          const fetchedModels = await entry.provider!.listModels({ signal: controller.signal });
          const modelInfos: ModelInfo[] = fetchedModels.map((model) => ({
            id: model.id,
            name: model.name,
            provider: entry.id,
            contextLength: model.contextLength,
            capabilities: model.capabilities,
            pricing: model.pricing,
          }));

          const timestamp = Date.now();
          modelCache.set(cacheKey, { models: modelInfos, timestamp });
          aggregated.push(...modelInfos);
          newestTimestamp = Math.max(newestTimestamp, timestamp);
        } catch (err) {
          const isAbort = err instanceof Error && err.name === "AbortError";
          nextErrors[entry.id] = isAbort
            ? "Request timed out"
            : err instanceof Error
              ? err.message
              : "Failed to fetch models";
        } finally {
          clearTimeout(timeout);
        }
      }),
    );

    cleanupExpiredCache();

    if (!mountedRef.current) {
      return;
    }

    const deduped = [...aggregated].sort((left, right) => {
      const providerOrder = left.provider.localeCompare(right.provider);
      if (providerOrder !== 0) {
        return providerOrder;
      }
      return `${left.name}\u0000${left.id}`.localeCompare(`${right.name}\u0000${right.id}`);
    });

    setModels(deduped);
    setProviderErrors(nextErrors);
    setLastUpdated(newestTimestamp > 0 ? new Date(newestTimestamp) : null);

    if (deduped.length > 0) {
      setError(null);
    } else if (Object.keys(nextErrors).length > 0) {
      const [firstProviderId] = Object.keys(nextErrors) as ProviderId[];
      setError(firstProviderId ? `${firstProviderId}: ${nextErrors[firstProviderId]}` : "Falha ao carregar modelos.");
    } else {
      setError("Nenhum modelo disponível.");
    }

    setLoading(false);
  }, [entries]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchCatalog();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchCatalog]);

  const refresh = useCallback(() => {
    entries.forEach((entry) => {
      if (entry.enabled) {
        modelCache.delete(entry.id);
      }
    });
    void fetchCatalog();
  }, [entries, fetchCatalog]);

  return { models, loading, error, providerErrors, refresh, lastUpdated };
}

export function clearModelCache(): void {
  modelCache.clear();
}
