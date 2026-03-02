import { parseISO } from "date-fns";
import { BENCHMARK, HYPERSCALER_TICKERS } from "@/lib/config";
import { prisma } from "@/lib/db";
import { fetchTextWithRetry } from "@/lib/http";
import { parseDate, safeNumber } from "@/lib/utils";

type StooqRow = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function parseStooqCsv(csv: string): StooqRow[] {
  const lines = csv
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  return lines.slice(1).flatMap((line) => {
    const [date, open, high, low, close, volume] = line.split(",").map((item) => item.trim());
    if (!date || open === undefined || high === undefined || low === undefined || close === undefined || volume === undefined) {
      return [];
    }

    return [
      {
        date: parseISO(date),
        open: safeNumber(open),
        high: safeNumber(high),
        low: safeNumber(low),
        close: safeNumber(close),
        volume: safeNumber(volume),
      },
    ];
  });
}

async function fetchTickerBars(stooqSymbol: string): Promise<StooqRow[]> {
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol}&i=d`;
  const response = await fetchTextWithRetry(url);
  return parseStooqCsv(response.text);
}

export async function ingestStockPrices(from: Date, to: Date): Promise<number> {
  let inserted = 0;
  const targets = [...HYPERSCALER_TICKERS, BENCHMARK];

  for (const target of targets) {
    const bars = await fetchTickerBars(target.stooq);

    for (const bar of bars) {
      const day = parseDate(bar.date);
      if (day < from || day > to) {
        continue;
      }

      await prisma.priceBar.upsert({
        where: {
          ticker_date: {
            ticker: target.ticker,
            date: day,
          },
        },
        update: {
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          source: "stooq",
        },
        create: {
          ticker: target.ticker,
          date: day,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          source: "stooq",
        },
      });
      inserted += 1;
    }
  }

  return inserted;
}
