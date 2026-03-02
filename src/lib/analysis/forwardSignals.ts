import { parseISO, subDays } from "date-fns";
import { DEFAULT_FROM_DATE, HYPERSCALER_TICKERS, LABS } from "@/lib/config";
import { prisma } from "@/lib/db";

const DEFAULT_SIGNAL_WINDOW = 7;
const DEFAULT_MIN_SAMPLES = 60;
const DEFAULT_RECENT_DAYS = 21;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toPct(value: number): number {
  return Number((value * 100).toFixed(3));
}

function labNameById(labId: string): string {
  return LABS.find((lab) => lab.id === labId)?.name ?? labId;
}

export type ForwardSignal = {
  labId: string;
  labName: string;
  ticker: string;
  horizonDays: number;
  nSamples: number;
  avgCar: number;
  avgCarPct: number;
  hitRate: number;
  hitRatePct: number;
  sigRate: number;
  sigRatePct: number;
  bestLagDays: number;
  bestLagCorrelation: number;
  confidenceScore: number;
  confidenceBand: "high" | "medium" | "low";
  direction: "long-bias" | "short-bias";
  actionable: boolean;
  recentLabEventCount: number;
  thesis: string;
};

export type PairIdea = {
  labId: string;
  labName: string;
  longTicker: string;
  shortTicker: string;
  expectedSpreadPct: number;
  confidenceScore: number;
  confidenceBand: "high" | "medium" | "low";
  thesis: string;
};

export type TrendingInsight = {
  id: string;
  headline: string;
  detail: string;
  importance: "high" | "medium" | "low";
};

export type NextBestAction = {
  id: string;
  action: string;
  rationale: string;
  priority: "high" | "medium" | "low";
  horizon: string;
};

export type ForwardSignalsResponse = {
  asOf: string;
  lookbackFrom: string;
  lookbackTo: string;
  sourceTier: "official" | "fallback";
  signalWindowDays: number;
  recentDays: number;
  regime: {
    tradeDaysWithEvents: number;
    multiLabBurstDays: number;
    burstRatio: number;
    recentLabEventCounts: Record<string, number>;
  };
  topSignals: ForwardSignal[];
  pairIdeas: PairIdea[];
  trendingInsights: TrendingInsight[];
  nextBestActions: NextBestAction[];
};

function confidenceBand(score: number): "high" | "medium" | "low" {
  if (score >= 0.72) return "high";
  if (score >= 0.52) return "medium";
  return "low";
}

function buildSignalThesis(signal: {
  labName: string;
  ticker: string;
  direction: "long-bias" | "short-bias";
  avgCarPct: number;
  sigRatePct: number;
  bestLagDays: number;
  bestLagCorrelation: number;
  recentLabEventCount: number;
  horizonDays: number;
}): string {
  const dirText = signal.direction === "long-bias" ? "upside" : "downside";
  const lagText = signal.bestLagDays > 0 ? `${signal.bestLagDays}-day lag` : "same-day";
  return `${signal.labName} release cycles show ${dirText} bias for ${signal.ticker} over ${signal.horizonDays} days (avg CAR ${signal.avgCarPct.toFixed(2)}%, p<0.1 frequency ${signal.sigRatePct.toFixed(1)}%). Best lag signal is ${lagText} (corr ${signal.bestLagCorrelation.toFixed(3)}). Recent lab event count: ${signal.recentLabEventCount}.`;
}

function scoreSignal(params: {
  nSamples: number;
  avgCar: number;
  sigRate: number;
  bestLagCorrelation: number;
  recentLabEventCount: number;
}): number {
  const sampleComponent = Math.min(1, params.nSamples / 300) * 0.3;
  const effectComponent = Math.min(1, Math.abs(params.avgCar) / 0.03) * 0.35;
  const significanceComponent = clamp01(params.sigRate) * 0.2;
  const lagComponent = Math.min(1, Math.abs(params.bestLagCorrelation) / 0.12) * 0.1;
  const recencyComponent = Math.min(1, params.recentLabEventCount / 15) * 0.05;
  return clamp01(sampleComponent + effectComponent + significanceComponent + lagComponent + recencyComponent);
}

function buildTrendingInsights(params: {
  burstRatio: number;
  multiLabBurstDays: number;
  tradeDaysWithEvents: number;
  topSignals: ForwardSignal[];
  pairIdeas: PairIdea[];
  recentLabEventCounts: Record<string, number>;
}): TrendingInsight[] {
  const insights: TrendingInsight[] = [];

  const burstLevel: "high" | "medium" | "low" =
    params.burstRatio >= 0.4 ? "high" : params.burstRatio >= 0.22 ? "medium" : "low";
  insights.push({
    id: "regime-burst",
    headline: "AI news clustering regime",
    detail: `${params.multiLabBurstDays}/${params.tradeDaysWithEvents || 1} recent event days were multi-lab burst days (ratio ${(params.burstRatio * 100).toFixed(1)}%).`,
    importance: burstLevel,
  });

  const topLong = params.topSignals.find((signal) => signal.actionable && signal.direction === "long-bias");
  if (topLong) {
    insights.push({
      id: "top-long-bias",
      headline: `Strongest upside bias: ${topLong.labName} -> ${topLong.ticker}`,
      detail: `Avg ${topLong.horizonDays}d CAR ${topLong.avgCarPct.toFixed(2)}% with ${topLong.sigRatePct.toFixed(1)}% p<0.1 frequency and ${topLong.nSamples} samples.`,
      importance: topLong.confidenceBand,
    });
  }

  const topShort = params.topSignals.find((signal) => signal.actionable && signal.direction === "short-bias");
  if (topShort) {
    insights.push({
      id: "top-short-bias",
      headline: `Strongest downside bias: ${topShort.labName} -> ${topShort.ticker}`,
      detail: `Avg ${topShort.horizonDays}d CAR ${topShort.avgCarPct.toFixed(2)}% with ${topShort.sigRatePct.toFixed(1)}% p<0.1 frequency and ${topShort.nSamples} samples.`,
      importance: topShort.confidenceBand,
    });
  }

  const topRecentLabs = Object.entries(params.recentLabEventCounts)
    .map(([labId, count]) => ({ labId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .filter((item) => item.count > 0);

  if (topRecentLabs.length > 0) {
    const detail = topRecentLabs.map((item) => `${labNameById(item.labId)}: ${item.count}`).join(", ");
    insights.push({
      id: "recent-lab-velocity",
      headline: "Recent publication velocity leaders",
      detail: `Highest event velocity in last window -> ${detail}.`,
      importance: topRecentLabs[0].count >= 10 ? "high" : "medium",
    });
  }

  if (params.pairIdeas[0]) {
    const topPair = params.pairIdeas[0];
    insights.push({
      id: "top-pair-setup",
      headline: `Top relative-value setup: ${topPair.labName}`,
      detail: `Long ${topPair.longTicker} / Short ${topPair.shortTicker} with expected spread ${topPair.expectedSpreadPct.toFixed(2)}% over 7d.`,
      importance: topPair.confidenceBand,
    });
  }

  return insights.slice(0, 6);
}

function buildNextBestActions(params: {
  burstRatio: number;
  topSignals: ForwardSignal[];
  pairIdeas: PairIdea[];
  sourceTier: "official" | "fallback";
}): NextBestAction[] {
  const actions: NextBestAction[] = [];

  if (params.pairIdeas[0]) {
    const topPair = params.pairIdeas[0];
    actions.push({
      id: "deploy-top-pair-watch",
      action: `Prepare event-triggered watch for Long ${topPair.longTicker} / Short ${topPair.shortTicker}`,
      rationale: `${topPair.labName} has the strongest relative spread setup (${topPair.expectedSpreadPct.toFixed(2)}% expected).`,
      priority: topPair.confidenceBand,
      horizon: "Next 1-2 weeks",
    });
  }

  const strongestSignals = params.topSignals
    .filter((signal) => signal.actionable)
    .slice(0, 3);
  if (strongestSignals.length > 0) {
    const label = strongestSignals
      .map((signal) => `${signal.labName}:${signal.ticker} (${signal.direction === "long-bias" ? "L" : "S"})`)
      .join(", ");
    actions.push({
      id: "top-signal-basket",
      action: "Build a small basket from top actionable lab/ticker signals",
      rationale: `Highest-confidence set is ${label}. Basketing reduces single-event noise.`,
      priority: "high",
      horizon: "Next 5-7 trading days",
    });
  }

  actions.push({
    id: "burst-regime-sizer",
    action: params.burstRatio >= 0.35 ? "Increase attention on multi-lab burst days" : "Keep burst-day sizing conservative",
    rationale:
      params.burstRatio >= 0.35
        ? "Current regime has elevated multi-lab clustering, where strongest signal magnitudes typically appear."
        : "Current regime has lower clustering, so single-event dispersion can dominate.",
    priority: params.burstRatio >= 0.35 ? "medium" : "low",
    horizon: "Continuous",
  });

  actions.push({
    id: "risk-control-check",
    action: params.sourceTier === "official" ? "Use official-only mode for decision support" : "Use fallback signals only as secondary confirmation",
    rationale:
      params.sourceTier === "official"
        ? "Official-source events have cleaner provenance and lower noise."
        : "Fallback-only events are useful for monitoring but less reliable as primary triggers.",
    priority: "medium",
    horizon: "Continuous",
  });

  return actions.slice(0, 6);
}

export async function getForwardSignals(params?: {
  from?: Date;
  to?: Date;
  asOf?: Date;
  labs?: string[];
  tickers?: string[];
  sourceTier?: "official" | "fallback";
  recentDays?: number;
  signalWindowDays?: number;
  minSamples?: number;
}): Promise<ForwardSignalsResponse> {
  const from = params?.from ?? parseISO(DEFAULT_FROM_DATE);
  const to = params?.to ?? new Date();
  const asOf = params?.asOf ?? to;
  const sourceTier = params?.sourceTier ?? "official";
  const recentDays = params?.recentDays ?? DEFAULT_RECENT_DAYS;
  const signalWindowDays = params?.signalWindowDays ?? DEFAULT_SIGNAL_WINDOW;
  const minSamples = params?.minSamples ?? DEFAULT_MIN_SAMPLES;

  const labs = params?.labs?.length ? params.labs : LABS.map((lab) => lab.id);
  const tickers = params?.tickers?.length ? params.tickers : HYPERSCALER_TICKERS.map((ticker) => ticker.ticker);

  const [impacts, correlations, recentEvents] = await Promise.all([
    prisma.eventImpact.findMany({
      where: {
        window: signalWindowDays,
        ticker: { in: tickers },
        event: {
          labId: { in: labs },
          sourceTier,
          effectiveTradingDate: { gte: from, lte: to },
        },
      },
      include: {
        event: {
          select: {
            labId: true,
            effectiveTradingDate: true,
          },
        },
      },
    }),
    prisma.correlationMetric.findMany({
      where: {
        labId: { in: labs },
        ticker: { in: tickers },
      },
      orderBy: [{ labId: "asc" }, { ticker: "asc" }, { lagDays: "asc" }],
    }),
    prisma.event.findMany({
      where: {
        labId: { in: labs },
        sourceTier,
        confidence: { gte: 0.6 },
        effectiveTradingDate: {
          gte: subDays(asOf, recentDays),
          lte: asOf,
        },
      },
      select: {
        labId: true,
        effectiveTradingDate: true,
      },
    }),
  ]);

  const bestLagByPair = new Map<string, { lagDays: number; correlation: number }>();
  for (const correlation of correlations) {
    const key = `${correlation.labId}::${correlation.ticker}`;
    const current = bestLagByPair.get(key);
    if (!current || Math.abs(correlation.correlation) > Math.abs(current.correlation)) {
      bestLagByPair.set(key, {
        lagDays: correlation.lagDays,
        correlation: correlation.correlation,
      });
    }
  }

  const recentLabEventCounts: Record<string, number> = Object.fromEntries(labs.map((labId) => [labId, 0]));
  const dayToLabs = new Map<string, Set<string>>();

  for (const event of recentEvents) {
    if (!event.effectiveTradingDate) {
      continue;
    }
    recentLabEventCounts[event.labId] = (recentLabEventCounts[event.labId] ?? 0) + 1;
    const day = event.effectiveTradingDate.toISOString().slice(0, 10);
    if (!dayToLabs.has(day)) {
      dayToLabs.set(day, new Set<string>());
    }
    dayToLabs.get(day)!.add(event.labId);
  }

  const tradeDaysWithEvents = dayToLabs.size;
  const multiLabBurstDays = Array.from(dayToLabs.values()).filter((set) => set.size >= 2).length;
  const burstRatio = tradeDaysWithEvents > 0 ? multiLabBurstDays / tradeDaysWithEvents : 0;

  const aggregates = new Map<
    string,
    {
      labId: string;
      ticker: string;
      nSamples: number;
      sumCar: number;
      sumPositive: number;
      sumSignificant: number;
    }
  >();

  for (const impact of impacts) {
    const key = `${impact.event.labId}::${impact.ticker}`;
    if (!aggregates.has(key)) {
      aggregates.set(key, {
        labId: impact.event.labId,
        ticker: impact.ticker,
        nSamples: 0,
        sumCar: 0,
        sumPositive: 0,
        sumSignificant: 0,
      });
    }

    const agg = aggregates.get(key)!;
    agg.nSamples += 1;
    agg.sumCar += impact.car;
    agg.sumPositive += impact.car > 0 ? 1 : 0;
    agg.sumSignificant += impact.pValue < 0.1 ? 1 : 0;
  }

  const signals: ForwardSignal[] = [];
  for (const aggregate of aggregates.values()) {
    if (aggregate.nSamples < minSamples) {
      continue;
    }

    const avgCar = aggregate.sumCar / aggregate.nSamples;
    const hitRate = aggregate.sumPositive / aggregate.nSamples;
    const sigRate = aggregate.sumSignificant / aggregate.nSamples;
    const bestLag = bestLagByPair.get(`${aggregate.labId}::${aggregate.ticker}`) ?? {
      lagDays: 0,
      correlation: 0,
    };

    const recentLabEventCount = recentLabEventCounts[aggregate.labId] ?? 0;
    const score = scoreSignal({
      nSamples: aggregate.nSamples,
      avgCar,
      sigRate,
      bestLagCorrelation: bestLag.correlation,
      recentLabEventCount,
    });

    const direction = avgCar >= 0 ? "long-bias" : "short-bias";
    const actionable = score >= 0.55 && Math.abs(avgCar) >= 0.007;
    const band = confidenceBand(score);

    const signal: ForwardSignal = {
      labId: aggregate.labId,
      labName: labNameById(aggregate.labId),
      ticker: aggregate.ticker,
      horizonDays: signalWindowDays,
      nSamples: aggregate.nSamples,
      avgCar,
      avgCarPct: toPct(avgCar),
      hitRate,
      hitRatePct: toPct(hitRate),
      sigRate,
      sigRatePct: toPct(sigRate),
      bestLagDays: bestLag.lagDays,
      bestLagCorrelation: Number(bestLag.correlation.toFixed(4)),
      confidenceScore: Number(score.toFixed(4)),
      confidenceBand: band,
      direction,
      actionable,
      recentLabEventCount,
      thesis: "",
    };

    signal.thesis = buildSignalThesis(signal);
    signals.push(signal);
  }

  const topSignals = signals
    .sort(
      (a, b) =>
        b.confidenceScore * Math.abs(b.avgCar) - a.confidenceScore * Math.abs(a.avgCar),
    )
    .slice(0, 30);

  const pairIdeas: PairIdea[] = [];
  const byLab = new Map<string, ForwardSignal[]>();
  for (const signal of topSignals) {
    if (!signal.actionable) continue;
    if (!byLab.has(signal.labId)) {
      byLab.set(signal.labId, []);
    }
    byLab.get(signal.labId)!.push(signal);
  }

  for (const [labId, labSignals] of byLab.entries()) {
    const positives = labSignals.filter((signal) => signal.avgCar > 0);
    const negatives = labSignals.filter((signal) => signal.avgCar < 0);

    if (!positives.length || !negatives.length) {
      continue;
    }

    positives.sort((a, b) => b.confidenceScore * b.avgCar - a.confidenceScore * a.avgCar);
    negatives.sort((a, b) => b.confidenceScore * Math.abs(b.avgCar) - a.confidenceScore * Math.abs(a.avgCar));

    const longSignal = positives[0];
    const shortSignal = negatives[0];
    const spread = longSignal.avgCar - shortSignal.avgCar;
    const score = clamp01(((longSignal.confidenceScore + shortSignal.confidenceScore) / 2) * (1 + burstRatio * 0.3));

    pairIdeas.push({
      labId,
      labName: labNameById(labId),
      longTicker: longSignal.ticker,
      shortTicker: shortSignal.ticker,
      expectedSpreadPct: toPct(spread),
      confidenceScore: Number(score.toFixed(4)),
      confidenceBand: confidenceBand(score),
      thesis: `${labNameById(labId)} event cycles historically favor ${longSignal.ticker} over ${shortSignal.ticker} over ${signalWindowDays} days (expected spread ${toPct(spread).toFixed(2)}%).`,
    });
  }

  pairIdeas.sort((a, b) => b.confidenceScore - a.confidenceScore);

  const trendingInsights = buildTrendingInsights({
    burstRatio,
    multiLabBurstDays,
    tradeDaysWithEvents,
    topSignals,
    pairIdeas,
    recentLabEventCounts,
  });

  const nextBestActions = buildNextBestActions({
    burstRatio,
    topSignals,
    pairIdeas,
    sourceTier,
  });

  return {
    asOf: asOf.toISOString(),
    lookbackFrom: from.toISOString(),
    lookbackTo: to.toISOString(),
    sourceTier,
    signalWindowDays,
    recentDays,
    regime: {
      tradeDaysWithEvents,
      multiLabBurstDays,
      burstRatio: Number(burstRatio.toFixed(4)),
      recentLabEventCounts,
    },
    topSignals,
    pairIdeas,
    trendingInsights,
    nextBestActions,
  };
}
