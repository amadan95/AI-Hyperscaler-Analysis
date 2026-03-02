import { addYears, isAfter, isBefore } from "date-fns";
import { prisma } from "@/lib/db";
import { ensureLabs, updateLabSourceAccess } from "@/lib/labs";
import { recomputeCorrelations } from "@/lib/analysis/correlations";
import { recomputeEventStudy } from "@/lib/analysis/eventStudy";
import { getTradingDays } from "@/lib/analysis/returns";
import { normalizeEvents } from "@/lib/ingest/normalize";
import { ingestStockPrices } from "@/lib/ingest/stocks";
import { upsertSourceStatus } from "@/lib/ingest/status";
import { ingestAnthropicEvents } from "@/lib/ingest/sources/anthropic";
import { ingestFallbackEvents } from "@/lib/ingest/sources/fallback";
import { ingestDeepMindEvents, ingestGoogleAiEvents } from "@/lib/ingest/sources/google";
import { ingestMistralEvents } from "@/lib/ingest/sources/mistral";
import { ingestOpenAiEvents } from "@/lib/ingest/sources/openai";
import { parseDate } from "@/lib/utils";
import type { SourceIngestResult } from "@/types/domain";

export function resolveEffectiveTradingDate(publishedAt: Date, tradingDays: Date[]): Date | null {
  const publishedDate = parseDate(publishedAt);
  for (const tradingDay of tradingDays) {
    if (!isBefore(tradingDay, publishedDate)) {
      return tradingDay;
    }
  }
  return null;
}

async function runSourceSafely(
  runner: () => Promise<SourceIngestResult>,
  fallbackMeta: { labId: string; sourceName: string; sourceTier: "official" | "fallback" },
): Promise<SourceIngestResult | null> {
  try {
    const result = await runner();
    await upsertSourceStatus({
      labId: result.labId,
      sourceName: result.sourceName,
      sourceTier: result.sourceTier,
      eventCount: result.events.length,
      etag: result.etag,
      lastModified: result.lastModified,
    });
    return result;
  } catch (error) {
    await upsertSourceStatus({
      ...fallbackMeta,
      eventCount: 0,
      error: error instanceof Error ? error.message : "Unknown source failure",
    });
    return null;
  }
}

async function ingestAllSources(from: Date, to: Date): Promise<SourceIngestResult[]> {
  const officialSources = await Promise.all([
    runSourceSafely(() => ingestOpenAiEvents(), { labId: "openai", sourceName: "openai-news-rss", sourceTier: "official" }),
    runSourceSafely(() => ingestAnthropicEvents(from, to), {
      labId: "anthropic",
      sourceName: "anthropic-sitemap",
      sourceTier: "official",
    }),
    runSourceSafely(() => ingestGoogleAiEvents(from, to), {
      labId: "google-deepmind",
      sourceName: "google-ai-sitemap",
      sourceTier: "official",
    }),
    runSourceSafely(() => ingestDeepMindEvents(from, to), {
      labId: "google-deepmind",
      sourceName: "deepmind-sitemap",
      sourceTier: "official",
    }),
    runSourceSafely(() => ingestMistralEvents(from, to), {
      labId: "mistral",
      sourceName: "mistral-sitemap",
      sourceTier: "official",
    }),
  ]);

  const fallbackSources = await ingestFallbackEvents(from, to);
  for (const source of fallbackSources) {
    await upsertSourceStatus({
      labId: source.labId,
      sourceName: source.sourceName,
      sourceTier: source.sourceTier,
      eventCount: source.events.length,
    });
  }

  return [...officialSources.filter((source): source is SourceIngestResult => Boolean(source)), ...fallbackSources];
}

async function persistEvents(from: Date, to: Date, sourceResults: SourceIngestResult[]): Promise<number> {
  const candidates = sourceResults.flatMap((source) => source.events);
  const normalized = normalizeEvents(candidates).filter((event) => {
    if (isBefore(event.publishedAt, from)) return false;
    return !isAfter(event.publishedAt, to);
  });

  const tradingDays = await getTradingDays();
  let count = 0;
  for (const event of normalized) {
    const effectiveTradingDate = resolveEffectiveTradingDate(event.publishedAt, tradingDays);
    await prisma.event.upsert({
      where: { hash: event.hash },
      update: {
        title: event.title,
        summary: event.summary,
        url: event.url,
        canonicalUrl: event.canonicalUrl,
        publishedAt: event.publishedAt,
        effectiveTradingDate,
        eventType: event.eventType,
        confidence: event.confidence,
        sourceTier: event.sourceTier,
        sourceName: event.sourceName,
      },
      create: {
        labId: event.labId,
        title: event.title,
        summary: event.summary,
        url: event.url,
        canonicalUrl: event.canonicalUrl,
        publishedAt: event.publishedAt,
        effectiveTradingDate,
        eventType: event.eventType,
        confidence: event.confidence,
        sourceTier: event.sourceTier,
        sourceName: event.sourceName,
        hash: event.hash,
      },
    });
    count += 1;
  }

  return count;
}

export type SyncSummary = {
  type: "backfill" | "incremental";
  from: string;
  to: string;
  stockRows: number;
  eventRows: number;
  eventImpacts: number;
  correlations: number;
};

async function runSync(type: "backfill" | "incremental", from: Date, to: Date): Promise<SyncSummary> {
  await ensureLabs();

  const syncRun = await prisma.syncRun.create({
    data: {
      type,
      fromDate: from,
      toDate: to,
      success: false,
    },
  });

  try {
    const stockRows = await ingestStockPrices(addYears(from, -1), to);
    const sourceResults = await ingestAllSources(from, to);
    const eventRows = await persistEvents(from, to, sourceResults);
    const eventImpacts = await recomputeEventStudy(from, to);
    const correlations = await recomputeCorrelations(from, to);

    for (const sourceResult of sourceResults) {
      await updateLabSourceAccess(sourceResult.labId);
    }

    const summary: SyncSummary = {
      type,
      from: from.toISOString(),
      to: to.toISOString(),
      stockRows,
      eventRows,
      eventImpacts,
      correlations,
    };

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        success: true,
        completedAt: new Date(),
        summary: JSON.stringify(summary),
      },
    });

    return summary;
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        success: false,
        completedAt: new Date(),
        summary: error instanceof Error ? error.message : "Unknown failure",
      },
    });
    throw error;
  }
}

export async function runBackfill(from: Date, to: Date): Promise<SyncSummary> {
  return runSync("backfill", from, to);
}

export async function runIncremental(now: Date): Promise<SyncSummary> {
  const to = parseDate(now);
  const from = addYears(to, -1);
  return runSync("incremental", from, to);
}
