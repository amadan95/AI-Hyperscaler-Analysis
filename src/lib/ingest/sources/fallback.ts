import { isAfter, isBefore } from "date-fns";
import type { SourceIngestResult } from "@/types/domain";
import { GOOGLE_NEWS_FALLBACK, RELEASE_KEYWORDS, type LabId } from "@/lib/config";
import { asArray, fetchTextWithRetry, parseXml, stripTags } from "@/lib/http";
import { normalizeWhitespace } from "@/lib/utils";

type RssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  source?: { value?: string; url?: string };
};

type GoogleNewsRss = {
  rss?: {
    channel?: {
      item?: RssItem | RssItem[];
    };
  };
};

function buildGoogleNewsUrl(domain: string): string {
  const query = encodeURIComponent(`site:${domain} (launch OR release OR introducing OR model OR api OR available)`);
  return `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
}

function hasReleaseSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return RELEASE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

async function fetchFallbackForLab(labId: LabId, from: Date, to: Date): Promise<SourceIngestResult["events"]> {
  const domains = GOOGLE_NEWS_FALLBACK[labId] ?? [];
  const events: SourceIngestResult["events"] = [];

  for (const domain of domains) {
    const response = await fetchTextWithRetry(buildGoogleNewsUrl(domain));
    const feed = parseXml<GoogleNewsRss>(response.text);
    const items = asArray(feed.rss?.channel?.item);

    for (const item of items) {
      if (!item?.title || !item.link || !item.pubDate) {
        continue;
      }
      const publishedAt = new Date(item.pubDate);
      if (Number.isNaN(publishedAt.getTime())) {
        continue;
      }
      if (isBefore(publishedAt, from) || isAfter(publishedAt, to)) {
        continue;
      }

      const summary = item.description ? stripTags(item.description) : undefined;
      const combined = `${item.title} ${summary ?? ""}`;
      if (!hasReleaseSignal(combined)) {
        continue;
      }

      events.push({
        labId,
        title: normalizeWhitespace(item.title),
        url: item.link,
        publishedAt,
        summary,
        sourceTier: "fallback",
        sourceName: "google-news-fallback",
      });
    }
  }

  return events;
}

export async function ingestFallbackEvents(from: Date, to: Date): Promise<SourceIngestResult[]> {
  const labs = Object.keys(GOOGLE_NEWS_FALLBACK) as LabId[];
  const results: SourceIngestResult[] = [];

  for (const labId of labs) {
    const events = await fetchFallbackForLab(labId, from, to);
    results.push({
      sourceName: "google-news-fallback",
      labId,
      sourceTier: "fallback",
      events,
    });
  }

  return results;
}
