import { parseISO } from "date-fns";
import { DEFAULT_FROM_DATE, EVENT_LAGS, EVENT_WINDOWS, HYPERSCALER_TICKERS, LABS } from "@/lib/config";

export function parseDateParam(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

export function parseListParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getDefaultFromDate(): Date {
  return parseISO(DEFAULT_FROM_DATE);
}

export function getDefaultTickers(): string[] {
  return HYPERSCALER_TICKERS.map((ticker) => ticker.ticker);
}

export function getDefaultLabs(): string[] {
  return LABS.map((lab) => lab.id);
}

export function parseWindows(value: string | null): number[] {
  const parsed = parseListParam(value)
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => EVENT_WINDOWS.includes(item as (typeof EVENT_WINDOWS)[number]));
  return parsed.length > 0 ? parsed : [...EVENT_WINDOWS];
}

export function parseLags(value: string | null): number[] {
  const parsed = parseListParam(value)
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => EVENT_LAGS.includes(item as (typeof EVENT_LAGS)[number]));
  return parsed.length > 0 ? parsed : [...EVENT_LAGS];
}
