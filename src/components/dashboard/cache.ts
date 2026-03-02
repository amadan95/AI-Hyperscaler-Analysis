import type { AppliedFilters } from "@/components/dashboard/types";

type CacheValue<T> = {
  value: T;
  timestamp: number;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheValue<unknown>>();

function serializeFilters(filters: AppliedFilters): string {
  return [
    filters.from,
    filters.to,
    filters.labs.join(","),
    filters.tickers.join(","),
    filters.minConfidence.toFixed(2),
    filters.sourceTier,
  ].join("|");
}

export function cacheKey(resource: string, filters: AppliedFilters): string {
  return `${resource}:${serializeFilters(filters)}`;
}

export function readCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return cached.value as T;
}

export function writeCache<T>(key: string, value: T): void {
  cache.set(key, { value, timestamp: Date.now() });
}

export function clearCache(): void {
  cache.clear();
}
