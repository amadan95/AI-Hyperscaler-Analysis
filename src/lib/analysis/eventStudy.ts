import { EVENT_WINDOWS, HYPERSCALER_TICKERS } from "@/lib/config";
import { prisma } from "@/lib/db";
import { buildAbnormalReturnSeries } from "@/lib/analysis/returns";
import { dateToKey } from "@/lib/utils";
import type { EventStudyResult, PriceSeriesRow } from "@/types/domain";

export function empiricalPValue(rows: PriceSeriesRow[], window: number, observedCar: number, blockedCenters: Set<number>): number {
  const candidates: number[] = [];
  for (let i = window; i < rows.length - window; i += 1) {
    if (!blockedCenters.has(i)) {
      candidates.push(i);
    }
  }

  if (candidates.length < 10) {
    return 1;
  }

  const samples = Math.min(1000, candidates.length);
  let extreme = 0;

  for (let i = 0; i < samples; i += 1) {
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    let car = 0;
    for (let j = idx - window; j <= idx + window; j += 1) {
      car += rows[j].abnormalReturn;
    }
    if (Math.abs(car) >= Math.abs(observedCar)) {
      extreme += 1;
    }
  }

  return (extreme + 1) / (samples + 1);
}

export function computeWindowMetrics(
  rows: PriceSeriesRow[],
  center: number,
  window: number,
): Pick<EventStudyResult, "rawReturn" | "abnormalReturn" | "car"> {
  let rawReturn = 0;
  let car = 0;

  for (let i = center - window; i <= center + window; i += 1) {
    rawReturn += rows[i].dailyReturn;
    car += rows[i].abnormalReturn;
  }

  return {
    rawReturn,
    abnormalReturn: car,
    car,
  };
}

export async function recomputeEventStudy(from: Date, to: Date): Promise<number> {
  const [events, returnsByTicker] = await Promise.all([
    prisma.event.findMany({
      where: {
        effectiveTradingDate: { not: null, gte: from, lte: to },
      },
      select: {
        id: true,
        effectiveTradingDate: true,
      },
    }),
    buildAbnormalReturnSeries(from, to),
  ]);

  const tickers = HYPERSCALER_TICKERS.map((item) => item.ticker);
  const results: EventStudyResult[] = [];

  for (const ticker of tickers) {
    const rows = returnsByTicker[ticker] ?? [];
    if (rows.length === 0) continue;

    const indexByDate = new Map<string, number>();
    rows.forEach((row, index) => {
      indexByDate.set(dateToKey(row.date), index);
    });

    const eventCenters = new Set<number>();
    const indexedEvents = events
      .map((event) => {
        const key = dateToKey(event.effectiveTradingDate as Date);
        const index = indexByDate.get(key);
        if (index === undefined) return null;
        eventCenters.add(index);
        return { eventId: event.id, index };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    for (const indexedEvent of indexedEvents) {
      for (const window of EVENT_WINDOWS) {
        if (indexedEvent.index - window < 0 || indexedEvent.index + window >= rows.length) {
          continue;
        }

        const metrics = computeWindowMetrics(rows, indexedEvent.index, window);
        const pValue = empiricalPValue(rows, window, metrics.car, eventCenters);

        results.push({
          eventId: indexedEvent.eventId,
          ticker,
          window,
          ...metrics,
          pValue,
        });
      }
    }
  }

  for (const result of results) {
    await prisma.eventImpact.upsert({
      where: {
        eventId_ticker_window: {
          eventId: result.eventId,
          ticker: result.ticker,
          window: result.window,
        },
      },
      update: {
        rawReturn: result.rawReturn,
        abnormalReturn: result.abnormalReturn,
        car: result.car,
        pValue: result.pValue,
      },
      create: result,
    });
  }

  return results.length;
}
