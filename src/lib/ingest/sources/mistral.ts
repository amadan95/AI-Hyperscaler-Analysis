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

export async function ingestMistralEvents(from: Date, to: Date): Promise<SourceIngestResult> {
  const response = await fetchTextWithRetry("https://mistral.ai/sitemap.xml");
  const sitemap = parseXml<Sitemap>(response.text);

  const urls = asArray(sitemap.urlset?.url)
    .map((entry) => ({
      loc: entry?.loc ? entry.loc.replace(/"\s*\/>$/, "") : null,
      lastmod: entry?.lastmod ? new Date(entry.lastmod) : null,
    }))
    .filter((entry) => Boolean(entry.loc) && (entry.loc ?? "").includes("/news/"))
    .filter((entry) => {
      if (!entry.lastmod) return true;
      const parsed = new Date(entry.lastmod);
      if (Number.isNaN(parsed.getTime())) return true;
      return !isBefore(parsed, from) && !isAfter(parsed, to);
    });

  const events = await mapWithConcurrency(urls, 6, async (item) => {
    try {
      const url = item.loc as string;
      const page = await fetchTextWithRetry(url);
      const title = extractTitle(page.text);
      const published = extractPublishedDate(page.text);
      const summary = extractDescription(page.text);

      return {
        labId: "mistral" as const,
        title,
        url,
        publishedAt: parseDate(published ?? item.lastmod ?? new Date()),
        summary,
        sourceTier: "official" as const,
        sourceName: "mistral-sitemap",
      };
    } catch {
      return null;
    }
  });

  return {
    sourceName: "mistral-sitemap",
    labId: "mistral",
    sourceTier: "official",
    events: events.filter((event): event is NonNullable<typeof event> => Boolean(event)),
    etag: response.etag,
    lastModified: response.lastModified,
  };
}
