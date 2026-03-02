import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getDefaultFromDate,
  getDefaultLabs,
  getDefaultTickers,
  parseDateParam,
  parseListParam,
  parseWindows,
} from "@/lib/api/params";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = parseDateParam(searchParams.get("from"), getDefaultFromDate());
  const to = parseDateParam(searchParams.get("to"), new Date());
  const labs = parseListParam(searchParams.get("labs"));
  const tickers = parseListParam(searchParams.get("tickers"));
  const windows = parseWindows(searchParams.get("windows"));

  const impacts = await prisma.eventImpact.findMany({
    where: {
      ticker: { in: tickers.length ? tickers : getDefaultTickers() },
      window: { in: windows },
      event: {
        labId: { in: labs.length ? labs : getDefaultLabs() },
        effectiveTradingDate: { gte: from, lte: to },
      },
    },
    include: {
      event: {
        include: {
          lab: true,
        },
      },
    },
    orderBy: [{ window: "asc" }, { ticker: "asc" }],
  });

  return NextResponse.json({
    from,
    to,
    windows,
    impacts,
  });
}
