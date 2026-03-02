import { isAfter, isBefore } from "date-fns";
import type { SourceIngestResult } from "@/types/domain";
import { mapWithConcurrency } from "@/lib/async";
import { asArray, fetchTextWithRetry, parseXml } from "@/lib/http";
import { parseDate } from "@/lib/utils";
import { extractDescription, extractPublishedDate, extractTitle } from "@/lib/ingest/sources/helpers";

type Sitemap = {
  urlset?: {
    url?: { loc?: string; lastmod?: string } | Array<{ loc?: string; lastmod?: string }>;
  };
};

export async function ingestAnthropicEvents(from: Date, to: Date): Promise<SourceIngestResult> {
  const response = await fetchTextWithRetry("https://www.anthropic.com/sitemap.xml");
  const sitemap = parseXml<Sitemap>(response.text);

  const urls = asArray(sitemap.urlset?.url)
    .map((item) => ({
      loc: item?.loc,
      lastmod: item?.lastmod ? new Date(item.lastmod) : null,
    }))
    .filter((item) => Boolean(item.loc) && item.loc?.includes("/news/"))
    .filter((item) => {
      if (!item.lastmod || Number.isNaN(item.lastmod.getTime())) return true;
      return !isBefore(item.lastmod, from) && !isAfter(item.lastmod, to);
    });

  const eventCandidates = await mapWithConcurrency(urls, 6, async (item) => {
    try {
      const url = item.loc as string;
      const page = await fetchTextWithRetry(url);
      const title = extractTitle(page.text);
      const pageDate = extractPublishedDate(page.text);
      const summary = extractDescription(page.text);

      return {
        labId: "anthropic" as const,
        title,
        url,
        publishedAt: parseDate(pageDate ?? item.lastmod ?? new Date()),
        summary,
        sourceTier: "official" as const,
        sourceName: "anthropic-sitemap",
      };
    } catch {
      return null;
    }
  });

  return {
    sourceName: "anthropic-sitemap",
    labId: "anthropic",
    sourceTier: "official",
    events: eventCandidates.filter((event): event is NonNullable<typeof event> => Boolean(event)),
    etag: response.etag,
    lastModified: response.lastModified,
  };
}
