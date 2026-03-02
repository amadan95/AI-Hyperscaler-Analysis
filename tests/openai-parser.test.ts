import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOpenAiRss } from "@/lib/ingest/sources/openai";

describe("parseOpenAiRss", () => {
  it("parses rss items into event candidates", () => {
    const xml = readFileSync(resolve(process.cwd(), "tests/fixtures/openai-rss.xml"), "utf8");
    const events = parseOpenAiRss(xml);

    expect(events).toHaveLength(2);
    expect(events[0].labId).toBe("openai");
    expect(events[0].title).toContain("Introducing GPT-5 API");
    expect(events[0].url).toContain("introducing-gpt-5-api");
  });
});
