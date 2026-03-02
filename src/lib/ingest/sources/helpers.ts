import { parse, parseISO } from "date-fns";
import { normalizeWhitespace } from "@/lib/utils";

const MONTH_DATE_PATTERNS = ["MMM d, yyyy", "MMMM d, yyyy", "MMM d yyyy", "MMMM d yyyy"];

export function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return normalizeWhitespace(titleMatch?.[1] ?? "Untitled event");
}

function extractMetaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function parseDateCandidate(candidate: string): Date | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso)) {
    return new Date(iso);
  }

  for (const pattern of MONTH_DATE_PATTERNS) {
    try {
      return parse(trimmed, pattern, new Date());
    } catch {
      // continue
    }
  }

  return null;
}

export function extractPublishedDate(html: string): Date | null {
  const metaKeys = [
    "article:published_time",
    "og:published_time",
    "datePublished",
    "publish-date",
    "pubdate",
    "sailthru.date",
  ];

  for (const key of metaKeys) {
    const content = extractMetaContent(html, key);
    if (content) {
      const parsed = parseDateCandidate(content);
      if (parsed) return parsed;
    }
  }

  const jsonDateMatches = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (jsonDateMatches?.[1]) {
    const parsed = parseDateCandidate(jsonDateMatches[1]);
    if (parsed) return parsed;
  }

  const textDateMatches = html.match(
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+20\d{2}\b/,
  );
  if (textDateMatches?.[0]) {
    const parsed = parseDateCandidate(textDateMatches[0]);
    if (parsed) return parsed;
  }

  const isoDateMatches = html.match(/\b20\d{2}-\d{2}-\d{2}\b/);
  if (isoDateMatches?.[0]) {
    return parseISO(isoDateMatches[0]);
  }

  return null;
}

export function extractDescription(html: string): string | undefined {
  const content = extractMetaContent(html, "description") ?? extractMetaContent(html, "og:description");
  return content ? normalizeWhitespace(content) : undefined;
}
