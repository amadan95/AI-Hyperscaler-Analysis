import type { LABS } from "@/lib/config";

export type PriceResponse = {
  points: Array<Record<string, number | string>>;
};

export type EventApi = {
  id: string;
  title: string;
  url: string;
  confidence: number;
  sourceTier: "official" | "fallback";
  publishedAt: string;
  effectiveTradingDate: string | null;
  labId: string;
  lab: { id: string; name: string };
};

export type EventResponse = {
  events: EventApi[];
};

export type EventStudyImpact = {
  id: string;
  ticker: string;
  window: number;
  rawReturn: number;
  abnormalReturn: number;
  car: number;
  pValue: number;
  event: {
    id: string;
    title: string;
    lab: { id: string; name: string };
    effectiveTradingDate: string | null;
  };
};

export type EventStudyResponse = {
  impacts: EventStudyImpact[];
};

export type CorrelationMetric = {
  id: string;
  lagDays: number;
  ticker: string;
  correlation: number;
  sampleSize: number;
  lab: { id: string; name: string };
};

export type CorrelationResponse = {
  correlations: CorrelationMetric[];
};

export type StatusResponse = {
  sources: Array<{
    id: string;
    sourceName: string;
    sourceTier: "official" | "fallback";
    eventCount: number;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastError: string | null;
    lab: { name: string };
  }>;
  latestRun: {
    id: string;
    type: string;
    success: boolean;
    createdAt: string;
    completedAt: string | null;
  } | null;
};

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

export type Theme = "light" | "dark";
export type DashboardRoute = "signals" | "context" | "diagnostics";
export type DashboardView = DashboardRoute;
export type PanelKey =
  | "hero"
  | "ranked"
  | "tape"
  | "timeline"
  | "event-study"
  | "correlation"
  | "quality"
  | "events";
export type FocusWindow = "1d" | "1w" | "1m";

export type FocusState = {
  focusLab?: string;
  focusTicker?: string;
  window?: FocusWindow;
};

export type SourceTierFilter = "all" | "official" | "fallback";
export type DensityMode = "compact" | "cozy";

export type DashboardSort =
  | "confidence-desc"
  | "confidence-asc"
  | "car-desc"
  | "car-asc"
  | "sig-rate-desc"
  | "sig-rate-asc"
  | "date-desc"
  | "date-asc"
  | "pvalue-desc"
  | "pvalue-asc";

export type AppliedFilters = {
  from: string;
  to: string;
  labs: string[];
  tickers: string[];
  minConfidence: number;
  sourceTier: SourceTierFilter;
};

export type DraftFilters = AppliedFilters;

export type QueryControls = FocusState & {
  route: DashboardRoute;
  panel?: PanelKey;
  sort: DashboardSort;
  page: number;
  density: DensityMode;
};

export type LoadState<T> = {
  data?: T;
  loading: boolean;
  error?: string;
  asOf?: string;
};

export type SourceTierOption = {
  value: SourceTierFilter;
  label: string;
};

export type LabId = (typeof LABS)[number]["id"];
