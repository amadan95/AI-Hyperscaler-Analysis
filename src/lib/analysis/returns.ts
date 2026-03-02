import { BENCHMARK, HYPERSCALER_TICKERS } from "@/lib/config";
import { prisma } from "@/lib/db";
import { dateToKey } from "@/lib/utils";
import type { PriceSeriesRow } from "@/types/domain";

export async function buildAbnormalReturnSeries(from: Date, to: Date): Promise<Record<string, PriceSeriesRow[]>> {
  const [benchmarkBars, tickerBars] = await Promise.all([
    prisma.priceBar.findMany({
      where: { ticker: BENCHMARK.ticker, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    }),
    prisma.priceBar.findMany({
      where: {
        ticker: { in: HYPERSCALER_TICKERS.map((ticker) => ticker.ticker) },
        date: { gte: from, lte: to },
      },
      orderBy: [{ ticker: "asc" }, { date: "asc" }],
    }),
  ]);

  const benchmarkReturns = new Map<string, number>();
  for (let i = 1; i < benchmarkBars.length; i += 1) {
    const prev = benchmarkBars[i - 1];
    const cur = benchmarkBars[i];
    const ret = prev.close === 0 ? 0 : (cur.close - prev.close) / prev.close;
    benchmarkReturns.set(dateToKey(cur.date), ret);
  }

  const barsByTicker = tickerBars.reduce<Record<string, typeof tickerBars>>((acc, bar) => {
    acc[bar.ticker] ||= [];
    acc[bar.ticker].push(bar);
    return acc;
  }, {});

  const seriesByTicker: Record<string, PriceSeriesRow[]> = {};

  for (const ticker of Object.keys(barsByTicker)) {
    const bars = barsByTicker[ticker];
    const rows: PriceSeriesRow[] = [];

    for (let i = 1; i < bars.length; i += 1) {
      const prev = bars[i - 1];
      const cur = bars[i];
      const dailyReturn = prev.close === 0 ? 0 : (cur.close - prev.close) / prev.close;
      const benchmarkReturn = benchmarkReturns.get(dateToKey(cur.date)) ?? 0;
      rows.push({
        ticker,
        date: cur.date,
        close: cur.close,
        dailyReturn,
        benchmarkReturn,
        abnormalReturn: dailyReturn - benchmarkReturn,
      });
    }

    seriesByTicker[ticker] = rows;
  }

  return seriesByTicker;
}

export async function getTradingDays(): Promise<Date[]> {
  const rows = await prisma.priceBar.findMany({
    where: { ticker: BENCHMARK.ticker },
    select: { date: true },
    orderBy: { date: "asc" },
  });
  return rows.map((row) => row.date);
}
