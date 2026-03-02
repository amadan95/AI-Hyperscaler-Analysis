import { DEFAULT_FROM_DATE, HYPERSCALER_TICKERS, LABS } from "@/lib/config";
import type {
  AppliedFilters,
  CorrelationMetric,
  DashboardRoute,
  DashboardSort,
  DashboardView,
  DensityMode,
  DraftFilters,
  EventApi,
  EventStudyImpact,
  FocusWindow,
  ForwardSignal,
  ForwardSignalsResponse,
  PanelKey,
  QueryControls,
  SourceTierFilter,
} from "@/components/dashboard/types";

export const SOURCE_TIER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "official", label: "Official" },
  { value: "fallback", label: "Fallback" },
] as const;

const SOURCE_TIER_VALUES = SOURCE_TIER_OPTIONS.map((option) => option.value);
const VALID_PANELS: PanelKey[] = ["hero", "ranked", "tape", "timeline", "event-study", "correlation", "quality", "events"];
const VALID_WINDOWS: FocusWindow[] = ["1d", "1w", "1m"];

export const VIEW_PATHS: Record<DashboardView, string> = {
  signals: "/",
  context: "/context",
  diagnostics: "/diagnostics",
};

export const SORT_OPTIONS: Record<DashboardView, Array<{ value: DashboardSort; label: string }>> = {
  signals: [
    { value: "confidence-desc", label: "Confidence: High to Low" },
    { value: "confidence-asc", label: "Confidence: Low to High" },
    { value: "car-desc", label: "Avg CAR: High to Low" },
    { value: "car-asc", label: "Avg CAR: Low to High" },
    { value: "sig-rate-desc", label: "Signal Rate: High to Low" },
    { value: "sig-rate-asc", label: "Signal Rate: Low to High" },
  ],
  context: [
    { value: "date-desc", label: "Catalysts: Newest First" },
    { value: "date-asc", label: "Catalysts: Oldest First" },
    { value: "confidence-desc", label: "Confidence: High to Low" },
    { value: "confidence-asc", label: "Confidence: Low to High" },
  ],
  diagnostics: [
    { value: "car-desc", label: "CAR: High to Low" },
    { value: "car-asc", label: "CAR: Low to High" },
    { value: "pvalue-asc", label: "P-value: Lowest First" },
    { value: "pvalue-desc", label: "P-value: Highest First" },
    { value: "date-desc", label: "Event Date: Newest First" },
    { value: "date-asc", label: "Event Date: Oldest First" },
  ],
};

const SORT_VALUES = Array.from(new Set(Object.values(SORT_OPTIONS).flatMap((options) => options.map((option) => option.value))));

export const DEFAULT_DENSITY: DensityMode = "cozy";

export const DEFAULT_FILTERS: AppliedFilters = {
  from: DEFAULT_FROM_DATE,
  to: getTodayIsoDate(),
  labs: LABS.map((lab) => lab.id),
  tickers: HYPERSCALER_TICKERS.map((ticker) => ticker.ticker),
  minConfidence: 0.6,
  sourceTier: "all",
};

export function defaultPanelForRoute(route: DashboardRoute): PanelKey {
  if (route === "signals") return "hero";
  if (route === "context") return "tape";
  return "event-study";
}

export function defaultWindowForRoute(route: DashboardRoute): FocusWindow {
  return route === "diagnostics" ? "1w" : "1w";
}

export function defaultSortForView(view: DashboardView): DashboardSort {
  if (view === "diagnostics") return "car-desc";
  if (view === "context") return "date-desc";
  return "confidence-desc";
}

export function defaultQueryControls(route: DashboardRoute): QueryControls {
  return {
    route,
    panel: defaultPanelForRoute(route),
    sort: defaultSortForView(route),
    page: 1,
    density: DEFAULT_DENSITY,
    window: defaultWindowForRoute(route),
  };
}

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDateInput(value: string | null, fallback: string): string {
  if (!value) return fallback;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseRoute(value: string | null, fallback: DashboardRoute): DashboardRoute {
  if (value === "signals" || value === "context" || value === "diagnostics") {
    return value;
  }
  return fallback;
}

function parsePanel(value: string | null, fallback: PanelKey): PanelKey {
  if (!value) return fallback;
  return VALID_PANELS.includes(value as PanelKey) ? (value as PanelKey) : fallback;
}

function parseWindow(value: string | null, fallback: FocusWindow): FocusWindow {
  if (!value) return fallback;
  return VALID_WINDOWS.includes(value as FocusWindow) ? (value as FocusWindow) : fallback;
}

function parseSourceTier(value: string | null): SourceTierFilter {
  if (!value) return DEFAULT_FILTERS.sourceTier;
  if (SOURCE_TIER_VALUES.includes(value as SourceTierFilter)) {
    return value as SourceTierFilter;
  }
  return DEFAULT_FILTERS.sourceTier;
}

function parseSelection(value: string | null, allowed: string[], fallback: string[]): string[] {
  if (!value) return [...fallback];
  const allowedSet = new Set(allowed);
  const parsed = Array.from(new Set(value.split(",").map((item) => item.trim()).filter((item) => allowedSet.has(item))));
  return parsed.length > 0 ? parsed : [...fallback];
}

function parseOptionalSelection(value: string | null, allowed: string[]): string | undefined {
  if (!value) return undefined;
  return allowed.includes(value) ? value : undefined;
}

function parseSort(value: string | null, view: DashboardView): DashboardSort {
  if (!value) return defaultSortForView(view);
  if (SORT_OPTIONS[view].some((option) => option.value === value) && SORT_VALUES.includes(value as DashboardSort)) {
    return value as DashboardSort;
  }
  return defaultSortForView(view);
}

function parseDensity(value: string | null): DensityMode {
  return value === "compact" ? "compact" : DEFAULT_DENSITY;
}

function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, parsed);
}

function parseMinConfidence(value: string | null): number {
  if (!value) return DEFAULT_FILTERS.minConfidence;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return DEFAULT_FILTERS.minConfidence;
  return clamp(parsed, 0.4, 1);
}

export function parseUrlState(search: string, routeView: DashboardRoute): { filters: AppliedFilters; controls: QueryControls } {
  const params = new URLSearchParams(search);
  const route = parseRoute(params.get("route") ?? params.get("view"), routeView);
  const filters: AppliedFilters = {
    from: parseDateInput(params.get("from"), DEFAULT_FILTERS.from),
    to: parseDateInput(params.get("to"), DEFAULT_FILTERS.to),
    minConfidence: parseMinConfidence(params.get("minConfidence")),
    sourceTier: parseSourceTier(params.get("sourceTier")),
    labs: parseSelection(params.get("labs"), LABS.map((lab) => lab.id), DEFAULT_FILTERS.labs),
    tickers: parseSelection(params.get("tickers"), HYPERSCALER_TICKERS.map((ticker) => ticker.ticker), DEFAULT_FILTERS.tickers),
  };

  const controls: QueryControls = {
    route,
    panel: parsePanel(params.get("panel"), defaultPanelForRoute(routeView)),
    sort: parseSort(params.get("sort"), route),
    page: parsePage(params.get("page")),
    density: parseDensity(params.get("density")),
    focusLab: parseOptionalSelection(params.get("focusLab"), LABS.map((lab) => lab.id)),
    focusTicker: parseOptionalSelection(params.get("focusTicker"), HYPERSCALER_TICKERS.map((ticker) => ticker.ticker)),
    window: parseWindow(params.get("window"), defaultWindowForRoute(routeView)),
  };

  return { filters, controls };
}

export function buildSearchParams(filters: AppliedFilters, controls: QueryControls): URLSearchParams {
  const params = new URLSearchParams();
  params.set("route", controls.route);
  params.set("from", filters.from);
  params.set("to", filters.to);
  params.set("labs", filters.labs.join(","));
  params.set("tickers", filters.tickers.join(","));
  params.set("minConfidence", filters.minConfidence.toFixed(2));
  params.set("sourceTier", filters.sourceTier);
  params.set("sort", controls.sort);
  params.set("page", String(controls.page));
  params.set("density", controls.density);

  if (controls.panel) params.set("panel", controls.panel);
  if (controls.focusLab) params.set("focusLab", controls.focusLab);
  if (controls.focusTicker) params.set("focusTicker", controls.focusTicker);
  if (controls.window) params.set("window", controls.window);

  return params;
}

export function createViewHref(route: DashboardRoute, filters: AppliedFilters, controls: QueryControls): string {
  const nextControls: QueryControls = {
    ...controls,
    route,
    panel: defaultPanelForRoute(route),
    sort: defaultSortForView(route),
    page: 1,
    focusLab: controls.focusLab,
    focusTicker: controls.focusTicker,
    window: controls.window,
  };
  const params = buildSearchParams(filters, nextControls);
  return `${VIEW_PATHS[route]}?${params.toString()}`;
}

export function areFiltersEqual(a: DraftFilters, b: AppliedFilters): boolean {
  if (a.from !== b.from || a.to !== b.to || a.minConfidence !== b.minConfidence || a.sourceTier !== b.sourceTier) {
    return false;
  }
  if (a.labs.length !== b.labs.length || a.tickers.length !== b.tickers.length) {
    return false;
  }
  return a.labs.every((item, index) => item === b.labs[index]) && a.tickers.every((item, index) => item === b.tickers[index]);
}

export function formatDate(value: string): string {
  if (!value) return "-";
  return value.slice(0, 10);
}

export function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function confidenceBadgeClass(confidence: "high" | "medium" | "low"): string {
  if (confidence === "high") return "badge-high";
  if (confidence === "medium") return "badge-medium";
  return "badge-low";
}

export function priorityBadgeClass(priority: "high" | "medium" | "low"): string {
  if (priority === "high") return "badge-priority-high";
  if (priority === "medium") return "badge-priority-medium";
  return "badge-low";
}

export function correlationCellClass(value: number): string {
  if (value >= 0.3) return "corr-positive-strong";
  if (value >= 0.1) return "corr-positive";
  if (value <= -0.3) return "corr-negative-strong";
  if (value <= -0.1) return "corr-negative";
  return "corr-neutral";
}

export function sortForwardSignals(signals: ForwardSignal[], sort: DashboardSort): ForwardSignal[] {
  const copy = [...signals];
  copy.sort((left, right) => {
    if (sort === "confidence-desc") return right.confidenceScore - left.confidenceScore;
    if (sort === "confidence-asc") return left.confidenceScore - right.confidenceScore;
    if (sort === "car-desc") return right.avgCar - left.avgCar;
    if (sort === "car-asc") return left.avgCar - right.avgCar;
    if (sort === "sig-rate-desc") return right.sigRate - left.sigRate;
    if (sort === "sig-rate-asc") return left.sigRate - right.sigRate;
    return right.confidenceScore - left.confidenceScore;
  });
  return copy;
}

export function sortEvents(events: EventApi[], sort: DashboardSort): EventApi[] {
  const copy = [...events];
  copy.sort((left, right) => {
    if (sort === "date-asc") return left.publishedAt.localeCompare(right.publishedAt);
    if (sort === "date-desc") return right.publishedAt.localeCompare(left.publishedAt);
    if (sort === "confidence-asc") return left.confidence - right.confidence;
    if (sort === "confidence-desc") return right.confidence - left.confidence;
    return right.publishedAt.localeCompare(left.publishedAt);
  });
  return copy;
}

export function sortEventImpacts(impacts: EventStudyImpact[], sort: DashboardSort): EventStudyImpact[] {
  const copy = [...impacts];
  copy.sort((left, right) => {
    if (sort === "car-asc") return left.car - right.car;
    if (sort === "car-desc") return right.car - left.car;
    if (sort === "pvalue-asc") return left.pValue - right.pValue;
    if (sort === "pvalue-desc") return right.pValue - left.pValue;
    return right.car - left.car;
  });
  return copy;
}

export function sortCorrelations(metrics: CorrelationMetric[]): CorrelationMetric[] {
  const copy = [...metrics];
  copy.sort((left, right) => Math.abs(right.correlation) - Math.abs(left.correlation));
  return copy;
}

export function paginate<T>(items: T[], page: number, size: number): { totalPages: number; currentPage: number; pageItems: T[] } {
  const safePageSize = Math.max(1, size);
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * safePageSize;
  const pageItems = items.slice(start, start + safePageSize);
  return { totalPages, currentPage, pageItems };
}

export function summarizeChart(points: Array<Record<string, number | string>>, tickers: string[]): string {
  if (points.length === 0 || tickers.length === 0) {
    return "No market tape data is loaded yet.";
  }

  const summaries = tickers
    .map((ticker) => {
      const numericValues = points
        .map((point) => point[ticker])
        .filter((value): value is number => typeof value === "number");
      if (numericValues.length < 2) {
        return null;
      }
      const start = numericValues[0];
      const end = numericValues[numericValues.length - 1];
      if (start === 0) return null;
      return { ticker, deltaPct: ((end - start) / start) * 100 };
    })
    .filter((item): item is { ticker: string; deltaPct: number } => item !== null)
    .sort((left, right) => right.deltaPct - left.deltaPct);

  if (summaries.length === 0) {
    return "Market tape is available, but not enough points exist to compute trend summaries.";
  }

  const leader = summaries[0];
  const laggard = summaries[summaries.length - 1];
  return `Best relative trend: ${leader.ticker} ${leader.deltaPct.toFixed(2)}%. Weakest relative trend: ${laggard.ticker} ${laggard.deltaPct.toFixed(2)}%.`;
}

export function topOpportunity(signals: ForwardSignal[]): ForwardSignal | undefined {
  if (signals.length === 0) return undefined;
  return [...signals]
    .sort((left, right) => {
      const leftScore = opportunityCompositeScore(left);
      const rightScore = opportunityCompositeScore(right);
      return rightScore - leftScore;
    })
    .at(0);
}

function opportunityCompositeScore(signal: ForwardSignal): number {
  const carTerm = clamp(signal.avgCar, -0.12, 0.12);
  const actionableTerm = signal.actionable ? 0.05 : 0;
  return signal.confidenceScore * 0.6 + signal.sigRate * 0.3 + carTerm * 0.1 + actionableTerm;
}

export type RegimeSummary = {
  label: string;
  note: string;
  tone: "high" | "medium" | "low";
};

export function classifyRegime(forward: ForwardSignalsResponse | undefined): RegimeSummary {
  const regime = forward?.regime;
  if (!regime) {
    return {
      label: "Regime Unavailable",
      note: "Run a refresh to load event-burst diagnostics.",
      tone: "low",
    };
  }

  const ratio = regime.burstRatio;
  if (ratio >= 0.5) {
    return {
      label: "Event Surge",
      note: `${(ratio * 100).toFixed(0)}% of event days are multi-lab bursts. Prioritize fast follow-through setups.`,
      tone: "high",
    };
  }

  if (ratio >= 0.25) {
    return {
      label: "Active Pulse",
      note: `${(ratio * 100).toFixed(0)}% burst ratio with recurring catalysts. Keep risk-sized directional ideas active.`,
      tone: "medium",
    };
  }

  return {
    label: "Sparse Cycle",
    note: `${(ratio * 100).toFixed(0)}% burst ratio. Favor selective and high-conviction entries only.`,
    tone: "low",
  };
}

export type OpportunityDelta = {
  edgeDeltaPct: number;
  confidenceDelta: number;
};

export function computeOpportunityDelta(current: ForwardSignal | undefined, previous: ForwardSignal | undefined): OpportunityDelta | undefined {
  if (!current || !previous) return undefined;
  return {
    edgeDeltaPct: current.avgCarPct - previous.avgCarPct,
    confidenceDelta: current.confidenceScore - previous.confidenceScore,
  };
}

export function composeWhyNowNarrative(forward: ForwardSignalsResponse | undefined, filters: AppliedFilters, focusLab?: string, focusTicker?: string): string {
  const top = topOpportunity(forward?.topSignals ?? []);
  const regime = classifyRegime(forward);
  const labLabel = focusLab ? LABS.find((lab) => lab.id === focusLab)?.name : undefined;
  const tickerLabel = focusTicker ?? undefined;

  const scope = [
    `Window ${filters.from} to ${filters.to}`,
    labLabel ? `focus lab ${labLabel}` : `${filters.labs.length} labs in scope`,
    tickerLabel ? `focus ticker ${tickerLabel}` : `${filters.tickers.length} tickers in scope`,
  ].join("; ");

  if (!top) {
    return `${scope}. ${regime.label}: ${regime.note}`;
  }

  return `${scope}. ${regime.label}: ${regime.note} Current leading setup is ${top.labName} vs ${top.ticker} (${(top.confidenceScore * 100).toFixed(0)} confidence, ${top.avgCarPct.toFixed(2)}% avg CAR).`;
}

export function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
