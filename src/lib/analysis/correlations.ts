import { EVENT_LAGS, HYPERSCALER_TICKERS, LABS } from "@/lib/config";
import { buildAbnormalReturnSeries } from "@/lib/analysis/returns";
import { prisma } from "@/lib/db";
import { addDaysDate, dateToKey, pearsonCorrelation } from "@/lib/utils";

export async function recomputeCorrelations(from: Date, to: Date): Promise<number> {
  const [events, returnsByTicker] = await Promise.all([
    prisma.event.findMany({
      where: {
        effectiveTradingDate: { not: null, gte: from, lte: to },
      },
      select: {
        labId: true,
        effectiveTradingDate: true,
        confidence: true,
      },
    }),
    buildAbnormalReturnSeries(from, to),
  ]);

  const intensityByLab = new Map<string, Map<string, number>>();
  for (const event of events) {
    const key = dateToKey(event.effectiveTradingDate as Date);
    if (!intensityByLab.has(event.labId)) {
      intensityByLab.set(event.labId, new Map<string, number>());
    }
    const labMap = intensityByLab.get(event.labId)!;
    labMap.set(key, (labMap.get(key) ?? 0) + event.confidence);
  }

  let count = 0;
  for (const lab of LABS) {
    const labIntensity = intensityByLab.get(lab.id) ?? new Map<string, number>();

    for (const ticker of HYPERSCALER_TICKERS.map((item) => item.ticker)) {
      const rows = returnsByTicker[ticker] ?? [];
      if (rows.length < 10) continue;

      for (const lagDays of EVENT_LAGS) {
        const xs: number[] = [];
        const ys: number[] = [];

        for (const row of rows) {
          const lagDate = addDaysDate(row.date, -lagDays);
          const x = labIntensity.get(dateToKey(lagDate)) ?? 0;
          xs.push(x);
          ys.push(row.abnormalReturn);
        }

        const correlation = pearsonCorrelation(xs, ys);

        await prisma.correlationMetric.upsert({
          where: {
            labId_ticker_lagDays: {
              labId: lab.id,
              ticker,
              lagDays,
            },
          },
          update: {
            correlation,
            sampleSize: xs.length,
          },
          create: {
            labId: lab.id,
            ticker,
            lagDays,
            correlation,
            sampleSize: xs.length,
          },
        });

        count += 1;
      }
    }
  }

  return count;
}
