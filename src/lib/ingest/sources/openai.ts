import { parseISO } from "date-fns";
import type { SourceIngestResult } from "@/types/domain";
import { asArray, fetchTextWithRetry, parseXml, stripTags } from "@/lib/http";
import { normalizeWhitespace } from "@/lib/utils";

type OpenAiRss = {
  rss?: {
    channel?: {
      item?:
        | {
            title?: string;
            link?: string;
            pubDate?: string;
            description?: string;
          }
        | Array<{
            title?: string;
            link?: string;
            pubDate?: string;
            description?: string;
          }>;
    };
  };
};

export async function ingestOpenAiEvents(): Promise<SourceIngestResult> {
  const response = await fetchTextWithRetry("https://openai.com/news/rss.xml");
  const events = parseOpenAiRss(response.text);

  return {
    sourceName: "openai-news-rss",
    labId: "openai",
    sourceTier: "official",
    events,
    etag: response.etag,
    lastModified: response.lastModified,
  };
}

export function parseOpenAiRss(xml: string): SourceIngestResult["events"] {
  const rss = parseXml<OpenAiRss>(xml);
  const items = asArray(rss.rss?.channel?.item);

  return items
    .map((item) => {
      if (!item?.title || !item.link || !item.pubDate) return null;
      const parsed = new Date(item.pubDate);
      if (Number.isNaN(parsed.getTime())) return null;

      return {
        labId: "openai" as const,
        title: normalizeWhitespace(item.title),
        url: item.link,
        publishedAt: parseISO(parsed.toISOString()),
        summary: item.description ? stripTags(item.description) : undefined,
        sourceTier: "official" as const,
        sourceName: "openai-news-rss",
      };
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event));
}
