import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDefaultFromDate, getDefaultTickers, parseDateParam, parseListParam } from "@/lib/api/params";
import { dateToKey } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = parseDateParam(searchParams.get("from"), getDefaultFromDate());
  const to = parseDateParam(searchParams.get("to"), new Date());
  const tickers = parseListParam(searchParams.get("tickers"));
  const selectedTickers = tickers.length ? tickers : getDefaultTickers();
  const normalize = (searchParams.get("normalize") ?? "true") !== "false";

  const bars = await prisma.priceBar.findMany({
    where: {
      ticker: { in: selectedTickers },
      date: { gte: from, lte: to },
    },
    orderBy: [{ date: "asc" }, { ticker: "asc" }],
  });

  const baseByTicker = new Map<string, number>();
  for (const bar of bars) {
    if (!baseByTicker.has(bar.ticker)) {
      baseByTicker.set(bar.ticker, bar.close || 1);
    }
  }

  const byDate = new Map<string, Record<string, number | string>>();
  for (const bar of bars) {
    const key = dateToKey(bar.date);
    if (!byDate.has(key)) {
      byDate.set(key, { date: key });
    }

    const row = byDate.get(key)!;
    const base = baseByTicker.get(bar.ticker) ?? 1;
    row[bar.ticker] = normalize ? (bar.close / base) * 100 : bar.close;
  }

  return NextResponse.json({
    from,
    to,
    tickers: selectedTickers,
    normalize,
    points: Array.from(byDate.values()),
    bars,
  });
}
