import { addDays, formatISO, parseISO, startOfDay } from "date-fns";
import { createHash } from "node:crypto";

export function toDateOnly(date: Date): Date {
  return startOfDay(date);
}

export function parseDate(input: string | Date): Date {
  if (input instanceof Date) return toDateOnly(input);
  return toDateOnly(parseISO(input));
}

export function dateToKey(input: Date): string {
  return formatISO(toDateOnly(input), { representation: "date" });
}

export function addDaysDate(input: Date, days: number): Date {
  return toDateOnly(addDays(input, days));
}

export function safeNumber(input: string): number {
  const value = Number.parseFloat(input);
  return Number.isFinite(value) ? value : 0;
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "oc"].forEach((key) =>
      url.searchParams.delete(key),
    );
    if (url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    const query = url.searchParams.toString();
    return query ? `${url.origin}${url.pathname}?${query}` : `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl;
  }
}

export function normalizedTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashEvent(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function pearsonCorrelation(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 3) return 0;
  const n = xs.length;
  const xMean = xs.reduce((sum, x) => sum + x, 0) / n;
  const yMean = ys.reduce((sum, y) => sum + y, 0) / n;

  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    numerator += dx * dy;
    xVariance += dx * dx;
    yVariance += dy * dy;
  }

  if (xVariance === 0 || yVariance === 0) return 0;
  return numerator / Math.sqrt(xVariance * yVariance);
}
