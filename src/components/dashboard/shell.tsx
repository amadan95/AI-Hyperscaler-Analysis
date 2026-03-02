"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { EVENT_WINDOWS, HYPERSCALER_TICKERS, LABS } from "@/lib/config";
import { clearCache, cacheKey, readCache, writeCache } from "@/components/dashboard/cache";
import styles from "@/components/dashboard/dashboard.module.css";
import { DiagnosticsView } from "@/components/dashboard/diagnostics-view";
import { OverviewView } from "@/components/dashboard/overview-view";
import { SignalsView } from "@/components/dashboard/signals-view";
import type {
  AppliedFilters,
  DashboardSort,
  DashboardView,
  DensityMode,
  DraftFilters,
  EventResponse,
  EventStudyResponse,
  ForwardSignalsResponse,
  LoadState,
  PriceResponse,
  QueryControls,
  SourceTierFilter,
  StatusResponse,
  Theme,
  CorrelationResponse,
} from "@/components/dashboard/types";
import {
  SOURCE_TIER_OPTIONS,
  SORT_OPTIONS,
  VIEW_PATHS,
  areFiltersEqual,
  buildSearchParams,
  createViewHref,
  defaultQueryControls,
  formatDate,
  formatDateTime,
  parseUrlState,
  readableError,
} from "@/components/dashboard/utils";

const THEME_STORAGE_KEY = "hyperscaler-dashboard-theme";
const MIN_SELECTION_COUNT = 1;
const TICKER_LABELS = Object.fromEntries(HYPERSCALER_TICKERS.map((item) => [item.ticker, item.label])) as Record<string, string>;

const EMPTY_PRICES: PriceResponse = { points: [] };
const EMPTY_EVENTS: EventResponse = { events: [] };
const EMPTY_IMPACTS: EventStudyResponse = { impacts: [] };
const EMPTY_CORRELATIONS: CorrelationResponse = { correlations: [] };
const EMPTY_STATUS: StatusResponse = { sources: [], latestRun: null };

function emptyForwardSignals(): ForwardSignalsResponse {
  return {
    asOf: new Date().toISOString(),
    lookbackFrom: "2023-01-01T00:00:00.000Z",
    lookbackTo: new Date().toISOString(),
    sourceTier: "official",
    signalWindowDays: 7,
    recentDays: 21,
    regime: {
      tradeDaysWithEvents: 0,
      multiLabBurstDays: 0,
      burstRatio: 0,
      recentLabEventCounts: {},
    },
    topSignals: [],
    pairIdeas: [],
    trendingInsights: [],
    nextBestActions: [],
  };
}

type DashboardShellProps = {
  routeView: DashboardView;
};

type ResourceName = "prices" | "events" | "impacts" | "correlations" | "status" | "forward";

export function DashboardShell({ routeView }: DashboardShellProps) {
  const [theme, setTheme] = useState<Theme>("light");
  const [isMounted, setIsMounted] = useState(false);
  const [announcement, setAnnouncement] = useState("Dashboard ready.");
  const [hydrated, setHydrated] = useState(false);

  const [draftFilters, setDraftFilters] = useState<DraftFilters>(() => parseUrlState("", routeView).filters);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(() => parseUrlState("", routeView).filters);
  const [controls, setControls] = useState<QueryControls>(() => defaultQueryControls(routeView));

  const [visibleChartTickers, setVisibleChartTickers] = useState<string[]>(appliedFilters.tickers);

  const [pricesState, setPricesState] = useState<LoadState<PriceResponse>>({ loading: false, data: EMPTY_PRICES });
  const [eventsState, setEventsState] = useState<LoadState<EventResponse>>({ loading: false, data: EMPTY_EVENTS });
  const [impactsState, setImpactsState] = useState<LoadState<EventStudyResponse>>({ loading: false, data: EMPTY_IMPACTS });
  const [correlationsState, setCorrelationsState] = useState<LoadState<CorrelationResponse>>({ loading: false, data: EMPTY_CORRELATIONS });
  const [statusState, setStatusState] = useState<LoadState<StatusResponse>>({ loading: false, data: EMPTY_STATUS });
  const [forwardState, setForwardState] = useState<LoadState<ForwardSignalsResponse>>({ loading: false, data: emptyForwardSignals() });

  const requestIdRef = useRef<Record<ResourceName, number>>({
    prices: 0,
    events: 0,
    impacts: 0,
    correlations: 0,
    status: 0,
    forward: 0,
  });

  const abortRef = useRef<Record<ResourceName, AbortController | null>>({
    prices: null,
    events: null,
    impacts: null,
    correlations: null,
    status: null,
    forward: null,
  });

  const hasUnsavedChanges = !areFiltersEqual(draftFilters, appliedFilters);

  const displayTicker = useCallback((ticker: string) => TICKER_LABELS[ticker] ?? ticker, []);

  const resourceUrl = useMemo(() => {
    const commonParams = new URLSearchParams({
      from: appliedFilters.from,
      to: appliedFilters.to,
      labs: appliedFilters.labs.join(","),
      tickers: appliedFilters.tickers.join(","),
    });

    const eventParams = new URLSearchParams({
      from: appliedFilters.from,
      to: appliedFilters.to,
      labs: appliedFilters.labs.join(","),
      minConfidence: appliedFilters.minConfidence.toString(),
    });

    if (appliedFilters.sourceTier !== "all") {
      eventParams.set("sourceTier", appliedFilters.sourceTier);
    }

    const forwardSourceTier: SourceTierFilter = appliedFilters.sourceTier === "fallback" ? "fallback" : "official";
    const forwardParams = new URLSearchParams({
      from: appliedFilters.from,
      to: appliedFilters.to,
      asOf: appliedFilters.to,
      labs: appliedFilters.labs.join(","),
      tickers: appliedFilters.tickers.join(","),
      sourceTier: forwardSourceTier,
      signalWindowDays: "7",
      recentDays: "21",
      minSamples: "40",
    });

    return {
      prices: `/api/prices?${commonParams.toString()}&normalize=true`,
      events: `/api/events?${eventParams.toString()}`,
      impacts: `/api/analysis/event-study?${commonParams.toString()}&windows=${EVENT_WINDOWS.join(",")}`,
      correlations: `/api/analysis/correlations?${commonParams.toString()}&lags=0,1,3,7`,
      status: "/api/status",
      forward: `/api/analysis/forward-signals?${forwardParams.toString()}`,
    };
  }, [appliedFilters]);

  const runResourceFetch = useCallback(async <T,>(
    resource: ResourceName,
    url: string,
    setState: React.Dispatch<React.SetStateAction<LoadState<T>>>,
    force: boolean,
    fallbackError: string,
  ) => {
    const key = cacheKey(resource, appliedFilters);
    if (!force) {
      const cached = readCache<T>(key);
      if (cached) {
        setState((previous) => ({ ...previous, data: cached, loading: false, error: undefined }));
        return;
      }
    }

    requestIdRef.current[resource] += 1;
    const requestId = requestIdRef.current[resource];
    abortRef.current[resource]?.abort();
    const controller = new AbortController();
    abortRef.current[resource] = controller;

    setState((previous) => ({ ...previous, loading: true, error: undefined }));

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const data = (await response.json()) as T;
      if (requestId !== requestIdRef.current[resource]) {
        return;
      }
      writeCache(key, data);
      setState({ data, loading: false, error: undefined, asOf: new Date().toISOString() });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (requestId !== requestIdRef.current[resource]) {
        return;
      }
      setState((previous) => ({
        ...previous,
        loading: false,
        error: readableError(error, fallbackError),
      }));
    } finally {
      if (requestId === requestIdRef.current[resource]) {
        abortRef.current[resource] = null;
      }
    }
  }, [appliedFilters]);

  const loadPrices = useCallback((force = false) => runResourceFetch<PriceResponse>("prices", resourceUrl.prices, setPricesState, force, "Could not load market tape."), [resourceUrl.prices, runResourceFetch]);
  const loadEvents = useCallback((force = false) => runResourceFetch<EventResponse>("events", resourceUrl.events, setEventsState, force, "Could not load event feed."), [resourceUrl.events, runResourceFetch]);
  const loadImpacts = useCallback((force = false) => runResourceFetch<EventStudyResponse>("impacts", resourceUrl.impacts, setImpactsState, force, "Could not load event-study diagnostics."), [resourceUrl.impacts, runResourceFetch]);
  const loadCorrelations = useCallback((force = false) => runResourceFetch<CorrelationResponse>("correlations", resourceUrl.correlations, setCorrelationsState, force, "Could not load lag-correlation diagnostics."), [resourceUrl.correlations, runResourceFetch]);
  const loadStatus = useCallback((force = false) => runResourceFetch<StatusResponse>("status", resourceUrl.status, setStatusState, force, "Could not load source health."), [resourceUrl.status, runResourceFetch]);
  const loadForward = useCallback((force = false) => runResourceFetch<ForwardSignalsResponse>("forward", resourceUrl.forward, setForwardState, force, "Could not load forward-signal model output."), [resourceUrl.forward, runResourceFetch]);

  const refreshCurrentView = useCallback((force = false) => {
    if (routeView === "overview") {
      void Promise.allSettled([loadPrices(force), loadEvents(force), loadStatus(force), loadForward(force)]);
      return;
    }

    if (routeView === "signals") {
      void Promise.allSettled([loadForward(force), loadStatus(force)]);
      return;
    }

    void Promise.allSettled([loadEvents(force), loadImpacts(force), loadCorrelations(force), loadStatus(force)]);
  }, [loadCorrelations, loadEvents, loadForward, loadImpacts, loadPrices, loadStatus, routeView]);

  useEffect(() => {
    const root = document.documentElement;
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const systemTheme: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const nextTheme: Theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : systemTheme;
    root.dataset.theme = nextTheme;
    setTheme(nextTheme);

    const parsed = parseUrlState(window.location.search, routeView);
    setDraftFilters(parsed.filters);
    setAppliedFilters(parsed.filters);
    setControls(parsed.controls);
    setVisibleChartTickers(parsed.filters.tickers);

    setHydrated(true);
    setIsMounted(true);
  }, [routeView]);

  useEffect(() => {
    if (!isMounted) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [isMounted, theme]);

  useEffect(() => {
    if (!hydrated) return;
    refreshCurrentView(false);
    setAnnouncement("Dashboard refreshed for applied filters.");
  }, [appliedFilters, hydrated, refreshCurrentView]);

  useEffect(() => {
    if (!hydrated) return;

    const nextSearch = buildSearchParams(appliedFilters, {
      ...controls,
      view: routeView,
    }).toString();

    const nextUrl = `${VIEW_PATHS[routeView]}?${nextSearch}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [appliedFilters, controls, hydrated, routeView]);

  useEffect(() => {
    if (!hydrated) return;

    const onPopState = () => {
      const parsed = parseUrlState(window.location.search, routeView);
      setDraftFilters(parsed.filters);
      setAppliedFilters(parsed.filters);
      setControls(parsed.controls);
      setVisibleChartTickers(parsed.filters.tickers);
      setAnnouncement("State restored from history.");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [hydrated, routeView]);

  useEffect(() => {
    const controllers = abortRef.current;
    return () => {
      (Object.keys(controllers) as ResourceName[]).forEach((key) => controllers[key]?.abort());
    };
  }, []);

  function updateDraft(partial: Partial<DraftFilters>) {
    setDraftFilters((previous) => ({ ...previous, ...partial }));
  }

  function toggleDraftLab(labId: string) {
    setDraftFilters((previous) => {
      const active = previous.labs.includes(labId);
      if (active && previous.labs.length === MIN_SELECTION_COUNT) {
        setAnnouncement("Keep at least one lab selected.");
        return previous;
      }
      const labs = active ? previous.labs.filter((id) => id !== labId) : [...previous.labs, labId];
      return { ...previous, labs };
    });
  }

  function toggleDraftTicker(ticker: string) {
    setDraftFilters((previous) => {
      const active = previous.tickers.includes(ticker);
      if (active && previous.tickers.length === MIN_SELECTION_COUNT) {
        setAnnouncement("Keep at least one ticker selected.");
        return previous;
      }
      const tickers = active ? previous.tickers.filter((id) => id !== ticker) : [...previous.tickers, ticker];
      return { ...previous, tickers };
    });
  }

  function toggleVisibleTicker(ticker: string) {
    setVisibleChartTickers((previous) => {
      if (!previous.includes(ticker)) {
        return [...previous, ticker];
      }
      if (previous.length === 1) {
        setAnnouncement("Keep at least one chart series visible.");
        return previous;
      }
      return previous.filter((item) => item !== ticker);
    });
  }

  function applyFilters() {
    if (draftFilters.labs.length < MIN_SELECTION_COUNT || draftFilters.tickers.length < MIN_SELECTION_COUNT) {
      setAnnouncement("Select at least one lab and one ticker before applying.");
      return;
    }
    if (draftFilters.from > draftFilters.to) {
      setAnnouncement("From date must be on or before To date.");
      return;
    }

    setAppliedFilters(draftFilters);
    setControls((previous) => ({ ...previous, page: 1 }));
    setVisibleChartTickers(draftFilters.tickers);
    setAnnouncement("Filters applied.");
  }

  function resetFilters() {
    const defaults = parseUrlState("", routeView).filters;
    setDraftFilters(defaults);
    setAnnouncement("Draft filters reset to defaults. Apply to refresh results.");
  }

  function refreshView() {
    clearCache();
    refreshCurrentView(true);
    setAnnouncement("View refresh requested.");
  }

  const isBusy = pricesState.loading || eventsState.loading || impactsState.loading || correlationsState.loading || statusState.loading || forwardState.loading;
  const latestEventDate = (eventsState.data?.events ?? []).reduce<string>((latest, event) => event.publishedAt > latest ? event.publishedAt : latest, "");

  const navLinks = [
    { view: "overview" as const, label: "Overview" },
    { view: "signals" as const, label: "Signals" },
    { view: "diagnostics" as const, label: "Diagnostics" },
  ];

  return (
    <main className={styles.root} aria-busy={isBusy}>
      <a className={styles.skipLink} href="#dashboard-main">Skip to Dashboard Content</a>
      <p className="sr-only" aria-live="polite">{announcement}</p>

      <div className={styles.app}>
        <header className={styles.commandBar}>
          <div className={styles.commandHeader}>
            <div>
              <h1 className={styles.commandTitle}>AI Lab vs Hyperscalers</h1>
              <p className={styles.commandSubtext}>Greenfield shell with explicit apply/reset workflow, URL state, and isolated panel recovery.</p>
            </div>
            <div className={styles.commandMeta}>
              {hasUnsavedChanges && <span className={styles.unsaved}>Unsaved Filter Changes</span>}
              <span className={clsx(styles.status, isBusy && styles.statusBusy)}>{isBusy ? "Updating..." : "Ready"}</span>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonQuiet}`}
                onClick={() => setTheme((previous) => (previous === "dark" ? "light" : "dark"))}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
              </button>
            </div>
          </div>

          <div className={styles.controlGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>From</span>
              <input className={styles.input} type="date" value={draftFilters.from} onChange={(event) => updateDraft({ from: event.target.value })} />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>To</span>
              <input className={styles.input} type="date" value={draftFilters.to} onChange={(event) => updateDraft({ to: event.target.value })} />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Min Confidence</span>
              <input
                className={styles.range}
                type="range"
                min={0.4}
                max={1}
                step={0.05}
                value={draftFilters.minConfidence}
                onChange={(event) => updateDraft({ minConfidence: Number.parseFloat(event.target.value) })}
                aria-describedby="min-confidence-value"
              />
              <span id="min-confidence-value" className={`${styles.smallHelp} ${styles.mono}`}>{draftFilters.minConfidence.toFixed(2)}</span>
            </label>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Source Tier</span>
              <div className={styles.segmented} role="group" aria-label="Source tier">
                {SOURCE_TIER_OPTIONS.map((option) => {
                  const active = draftFilters.sourceTier === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={clsx(styles.segmentedButton, active && styles.segmentedButtonActive)}
                      onClick={() => updateDraft({ sourceTier: option.value })}
                      aria-pressed={active}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Sort</span>
              <select
                className={styles.select}
                value={controls.sort}
                onChange={(event) => setControls((previous) => ({ ...previous, sort: event.target.value as DashboardSort, page: 1 }))}
              >
                {SORT_OPTIONS[routeView].map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Density</span>
              <select
                className={styles.select}
                value={controls.density}
                onChange={(event) => setControls((previous) => ({ ...previous, density: event.target.value as DensityMode }))}
              >
                <option value="cozy">Cozy</option>
                <option value="compact">Compact</option>
              </select>
            </label>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Labs</span>
              <div className={styles.chipGroup}>
                {LABS.map((lab) => {
                  const active = draftFilters.labs.includes(lab.id);
                  return (
                    <button
                      key={lab.id}
                      type="button"
                      className={clsx(styles.chip, active && styles.chipActive)}
                      onClick={() => toggleDraftLab(lab.id)}
                      aria-pressed={active}
                    >
                      {lab.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Tickers</span>
              <div className={styles.chipGroup}>
                {HYPERSCALER_TICKERS.map((ticker) => {
                  const active = draftFilters.tickers.includes(ticker.ticker);
                  return (
                    <button
                      key={ticker.ticker}
                      type="button"
                      className={clsx(styles.chip, active && styles.chipActive)}
                      onClick={() => toggleDraftTicker(ticker.ticker)}
                      aria-pressed={active}
                    >
                      {ticker.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={styles.actionRow}>
            <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={applyFilters}>Apply Filters</button>
            <button type="button" className={`${styles.button} ${styles.buttonQuiet}`} onClick={resetFilters}>Reset Draft</button>
            <button type="button" className={`${styles.button} ${styles.buttonAccent}`} onClick={refreshView}>Refresh View</button>
          </div>

          <p className={styles.smallHelp}>
            Applied window: <span className={styles.mono}>{appliedFilters.from} → {appliedFilters.to}</span>
            {latestEventDate ? ` · Latest event: ${formatDate(latestEventDate)}` : " · Latest event: -"}
            {statusState.data?.latestRun ? ` · Last run: ${statusState.data.latestRun.type} (${statusState.data.latestRun.success ? "success" : "failed"}) at ${formatDateTime(statusState.data.latestRun.createdAt)}` : ""}
          </p>
        </header>

        <div className={styles.mainLayout}>
          <nav className={styles.nav} aria-label="Dashboard views">
            {navLinks.map((link) => {
              const href = createViewHref(link.view, appliedFilters, controls);
              const active = link.view === routeView;
              return (
                <Link key={link.view} href={href} className={clsx(styles.navLink, active && styles.navLinkActive)} aria-current={active ? "page" : undefined}>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div id="dashboard-main" className={styles.content} tabIndex={-1}>
            {routeView === "overview" && (
              <OverviewView
                isMounted={isMounted}
                sort={controls.sort}
                density={controls.density}
                page={controls.page}
                onPageChange={(page) => setControls((previous) => ({ ...previous, page: Math.max(1, page) }))}
                pricesState={pricesState}
                eventsState={eventsState}
                statusState={statusState}
                forwardState={forwardState}
                selectedTickers={appliedFilters.tickers}
                visibleTickers={visibleChartTickers}
                onToggleTicker={toggleVisibleTicker}
                displayTicker={displayTicker}
                onRetryPrices={() => void loadPrices(true)}
                onRetryEvents={() => void loadEvents(true)}
                onRetryStatus={() => void loadStatus(true)}
                onRetryForward={() => void loadForward(true)}
              />
            )}

            {routeView === "signals" && (
              <SignalsView
                sort={controls.sort}
                density={controls.density}
                page={controls.page}
                onPageChange={(page) => setControls((previous) => ({ ...previous, page: Math.max(1, page) }))}
                displayTicker={displayTicker}
                forwardState={forwardState}
                onRetryForward={() => void loadForward(true)}
              />
            )}

            {routeView === "diagnostics" && (
              <DiagnosticsView
                sort={controls.sort}
                density={controls.density}
                page={controls.page}
                onPageChange={(page) => setControls((previous) => ({ ...previous, page: Math.max(1, page) }))}
                displayTicker={displayTicker}
                eventsState={eventsState}
                impactsState={impactsState}
                correlationsState={correlationsState}
                statusState={statusState}
                onRetryEvents={() => void loadEvents(true)}
                onRetryImpacts={() => void loadImpacts(true)}
                onRetryCorrelations={() => void loadCorrelations(true)}
                onRetryStatus={() => void loadStatus(true)}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
