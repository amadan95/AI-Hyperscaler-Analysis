import { describe, expect, it } from "vitest";
import { normalizeEvents } from "@/lib/ingest/normalize";

describe("normalizeEvents", () => {
  it("filters non-release posts and deduplicates close duplicates", () => {
    const input = [
      {
        labId: "openai" as const,
        title: "Introducing GPT API",
        url: "https://openai.com/index/gpt-api/?utm_source=x",
        publishedAt: new Date("2024-01-10T10:00:00Z"),
        summary: "API launch",
        sourceTier: "official" as const,
        sourceName: "openai-news-rss",
      },
      {
        labId: "openai" as const,
        title: "Introducing GPT API",
        url: "https://openai.com/index/gpt-api/",
        publishedAt: new Date("2024-01-11T10:00:00Z"),
        summary: "API launch duplicate",
        sourceTier: "official" as const,
        sourceName: "openai-news-rss",
      },
      {
        labId: "openai" as const,
        title: "Policy hiring update",
        url: "https://openai.com/index/policy-hiring/",
        publishedAt: new Date("2024-01-10T10:00:00Z"),
        summary: "Hiring announcement",
        sourceTier: "official" as const,
        sourceName: "openai-news-rss",
      },
    ];

    const normalized = normalizeEvents(input);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].canonicalUrl).toBe("https://openai.com/index/gpt-api");
    expect(normalized[0].confidence).toBe(1);
    expect(normalized[0].eventType).toBe("launch");
  });
});
