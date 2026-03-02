import { isAfter, isBefore } from "date-fns";
import type { SourceIngestResult } from "@/types/domain";
import { mapWithConcurrency } from "@/lib/async";
import { asArray, fetchTextWithRetry, parseXml } from "@/lib/http";
import { parseDate } from "@/lib/utils";
import { extractDescription, extractPublishedDate, extractTitle } from "@/lib/ingest/sources/helpers";

type UrlEntry = { loc?: string; lastmod?: string };

type Sitemap = {
  urlset?: {
    url?: UrlEntry | UrlEntry[];
  };
};

const URL_SIGNAL_KEYWORDS = [
  "gemini",
  "model",
  "api",
  "launch",
  "release",
  "introducing",
  "imagen",
  "veo",
  "genie",
  "agent",
  "ai",
];

function isUrlRelevant(url: string): boolean {
  const lower = url.toLowerCase();
  return URL_SIGNAL_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function filterRange(dateValue: string | Date | null | undefined, from: Date, to: Date): boolean {
  if (!dateValue) return true;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return true;
  return !isBefore(parsed, from) && !isAfter(parsed, to);
}

async function parseGoogleLikeArticle(
  url: string,
  labId: "google-deepmind",
  fallbackDate: Date | null,
): Promise<SourceIngestResult["events"][number] | null> {
  try {
    const page = await fetchTextWithRetry(url);
    const title = extractTitle(page.text);
    const published = extractPublishedDate(page.text);
    const summary = extractDescription(page.text);

    return {
      labId,
      title,
      url,
      publishedAt: parseDate(published ?? fallbackDate ?? new Date()),
      summary,
      sourceTier: "official",
      sourceName: url.includes("deepmind.google") ? "deepmind-sitemap" : "google-ai-sitemap",
    };
  } catch {
    return null;
  }
}

export async function ingestGoogleAiEvents(from: Date, to: Date): Promise<SourceIngestResult> {
  const response = await fetchTextWithRetry("https://blog.google/en-us/sitemap.xml");
  const sitemap = parseXml<Sitemap>(response.text);

  const urls = asArray(sitemap.urlset?.url)
    .map((entry) => ({
      loc: entry?.loc ?? null,
      lastmod: entry?.lastmod ? new Date(entry.lastmod) : null,
    }))
    .filter((entry) => Boolean(entry?.loc))
    .filter((entry) => (entry?.loc ?? "").startsWith("https://blog.google/innovation-and-ai/"))
    .filter((entry) => filterRange(entry?.lastmod, from, to))
    .filter((entry) => {
      const url = entry.loc as string;
      return !url.endsWith("/innovation-and-ai/") && isUrlRelevant(url);
    });

  const unique = Array.from(new Map(urls.map((entry) => [entry.loc as string, entry])).values());
  const events = await mapWithConcurrency(unique, 8, async (entry) =>
    parseGoogleLikeArticle(entry.loc as string, "google-deepmind", entry.lastmod),
  );

  return {
    sourceName: "google-ai-sitemap",
    labId: "google-deepmind",
    sourceTier: "official",
    events: events.filter((event): event is NonNullable<typeof event> => Boolean(event)),
    etag: response.etag,
    lastModified: response.lastModified,
  };
}

export async function ingestDeepMindEvents(from: Date, to: Date): Promise<SourceIngestResult> {
  const response = await fetchTextWithRetry("https://deepmind.google/sitemap.xml");
  const sitemap = parseXml<Sitemap>(response.text);

  const urls = asArray(sitemap.urlset?.url)
    .map((entry) => ({
      loc: entry?.loc ?? null,
      lastmod: entry?.lastmod ? new Date(entry.lastmod) : null,
    }))
    .filter((entry) => Boolean(entry?.loc))
    .filter((entry) => (entry?.loc ?? "").includes("/blog/"))
    .filter((entry) => filterRange(entry?.lastmod, from, to))
    .filter((entry) => isUrlRelevant(entry.loc as string));

  const unique = Array.from(new Map(urls.map((entry) => [entry.loc as string, entry])).values());
  const events = await mapWithConcurrency(unique, 8, async (entry) =>
    parseGoogleLikeArticle(entry.loc as string, "google-deepmind", entry.lastmod),
  );

  return {
    sourceName: "deepmind-sitemap",
    labId: "google-deepmind",
    sourceTier: "official",
    events: events.filter((event): event is NonNullable<typeof event> => Boolean(event)),
    etag: response.etag,
    lastModified: response.lastModified,
  };
}
