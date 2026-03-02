import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDefaultLabs, getDefaultTickers, parseLags, parseListParam } from "@/lib/api/params";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const labs = parseListParam(searchParams.get("labs"));
  const tickers = parseListParam(searchParams.get("tickers"));
  const lags = parseLags(searchParams.get("lags"));

  const correlations = await prisma.correlationMetric.findMany({
    where: {
      labId: { in: labs.length ? labs : getDefaultLabs() },
      ticker: { in: tickers.length ? tickers : getDefaultTickers() },
      lagDays: { in: lags },
    },
    include: {
      lab: true,
    },
    orderBy: [{ labId: "asc" }, { ticker: "asc" }, { lagDays: "asc" }],
  });

  return NextResponse.json({
    lags,
    correlations,
  });
}
