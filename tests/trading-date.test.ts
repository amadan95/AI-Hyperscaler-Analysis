import { describe, expect, it } from "vitest";
import { resolveEffectiveTradingDate } from "@/lib/ingest/pipeline";

describe("resolveEffectiveTradingDate", () => {
  it("maps non-trading day events to next trading day", () => {
    const tradingDays = [
      new Date("2024-01-05T00:00:00Z"),
      new Date("2024-01-08T00:00:00Z"),
      new Date("2024-01-09T00:00:00Z"),
    ];

    const weekendEvent = new Date("2024-01-06T18:00:00Z");
    const resolved = resolveEffectiveTradingDate(weekendEvent, tradingDays);

    expect(resolved?.toISOString()).toContain("2024-01-08");
  });
});
