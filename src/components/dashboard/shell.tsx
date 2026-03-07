"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Activity, FlaskConical, Orbit } from "lucide-react";
import { DEFAULT_FROM_DATE, EVENT_WINDOWS, HYPERSCALER_TICKERS, LABS } from "@/lib/config";
import { clearCache, readCache, scopedCacheKey, writeCache } from "@/components/dashboard/cache";
import { DashboardChrome, FilterDock, Masthead, RouteRail } from "@/components/dashboard/chrome";
import styles from "@/components/dashboard/dashboard.module.css";
import { ContextView } from "@/components/dashboard/context-view";
import { DiagnosticsView } from "@/components/dashboard/diagnostics-view";
import { SignalsView } from "@/components/dashboard/signals-view";
import type {
  AppliedFilters,
  CorrelationResponse,
  DashboardRoute,
  DashboardSort,
  DensityMode,
  DraftFilters,
  EventResponse,
  EventStudyResponse,
  FocusWindow,
  ForwardSignal,
  ForwardSignalsResponse,
  LoadState,
  PanelKey,
  PriceResponse,
  QueryControls,
  SourceTierFilter,
  StatusResponse,
  Theme,
} from "@/components/dashboard/types";
import {
  SOURCE_TIER_OPTIONS,
  SORT_OPTIONS,
  VIEW_PATHS,
  areFiltersEqual,
  buildSearchParams,
  computeOpportunityDelta,
  createViewHref,
  defaultQueryControls,
  formatDate,
  formatDateTime,
  parseUrlState,
  readableError,
  topOpportunity,
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
  routeView: DashboardRoute;
};

type ResourceName = "prices" | "events" | "impacts" | "correlations" | "status" | "forward";

type OpportunityDelta = {
  edgeDeltaPct: number;
  confidenceDelta: number;
};

type SyncMode = "backfill" | "incremental";

export function DashboardShell({ routeView }: DashboardShellProps) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [isMounted, setIsMounted] = useState(false);
  const [announcement, setAnnouncement] = useState("Editorial desk ready.");
  const [hydrated, setHydrated] = useState(false);
  const [syncingMode, setSyncingMode] = useState<SyncMode | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | undefined>(undefined);

  const [draftFilters, setDraftFilters] = useState<DraftFilters>(() => parseUrlState("", routeView).filters);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(() => parseUrlState("", routeView).filters);
  const [controls, setControls] = useState<QueryControls>(() => defaultQueryControls(routeView));

  const [visibleChartTickers, setVisibleChartTickers] = useState<string[]>(appliedFilters.tickers);
  const [opportunityDelta, setOpportunityDelta] = useState<OpportunityDelta | undefined>(undefined);

  const [pricesState, setPricesState] = useState<LoadState<PriceResponse>>({ loading: false, data: EMPTY_PRICES });
  const [eventsState, setEventsState] = useState<LoadState<EventResponse>>({ loading: false, data: EMPTY_EVENTS });
  const [impactsState, setImpactsState] = useState<LoadState<EventStudyResponse>>({ loading: false, data: EMPTY_IMPACTS });
  const [correlationsState, setCorrelationsState] = useState<LoadState<CorrelationResponse>>({ loading: false, data: EMPTY_CORRELATIONS });
  const [statusState, setStatusState] = useState<LoadState<StatusResponse>>({ loading: false, data: EMPTY_STATUS });
  const [forwardState, setForwardState] = useState<LoadState<ForwardSignalsResponse>>({ loading: false, data: emptyForwardSignals() });

  const previousTopRef = useRef<ForwardSignal | undefined>(undefined);

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
    const key = scopedCacheKey(resource, appliedFilters, routeView);
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
  }, [appliedFilters, routeView]);

  const loadPrices = useCallback((force = false) => runResourceFetch<PriceResponse>("prices", resourceUrl.prices, setPricesState, force, "Could not load market tape."), [resourceUrl.prices, runResourceFetch]);
  const loadEvents = useCallback((force = false) => runResourceFetch<EventResponse>("events", resourceUrl.events, setEventsState, force, "Could not load event feed."), [resourceUrl.events, runResourceFetch]);
  const loadImpacts = useCallback((force = false) => runResourceFetch<EventStudyResponse>("impacts", resourceUrl.impacts, setImpactsState, force, "Could not load event-study diagnostics."), [resourceUrl.impacts, runResourceFetch]);
  const loadCorrelations = useCallback((force = false) => runResourceFetch<CorrelationResponse>("correlations", resourceUrl.correlations, setCorrelationsState, force, "Could not load lag-correlation diagnostics."), [resourceUrl.correlations, runResourceFetch]);
  const loadStatus = useCallback((force = false) => runResourceFetch<StatusResponse>("status", resourceUrl.status, setStatusState, force, "Could not load source reliability."), [resourceUrl.status, runResourceFetch]);
  const loadForward = useCallback((force = false) => runResourceFetch<ForwardSignalsResponse>("forward", resourceUrl.forward, setForwardState, force, "Could not load forward-signal model output."), [resourceUrl.forward, runResourceFetch]);

  const refreshCurrentView = useCallback((force = false) => {
    if (routeView === "signals") {
      void Promise.allSettled([loadEvents(force), loadForward(force), loadStatus(force)]);
      return;
    }

    if (routeView === "context") {
      void Promise.allSettled([loadPrices(force), loadEvents(force), loadStatus(force), loadForward(force)]);
      return;
    }

    void Promise.allSettled([loadEvents(force), loadImpacts(force), loadCorrelations(force), loadStatus(force)]);
  }, [loadCorrelations, loadEvents, loadForward, loadImpacts, loadPrices, loadStatus, routeView]);

  const runSync = useCallback(async (mode: SyncMode) => {
    if (syncingMode) return;

    const endpoint = mode === "backfill" ? "/api/sync/backfill" : "/api/sync/incremental";
    const init = mode === "backfill"
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ from: DEFAULT_FROM_DATE }),
        }
      : { method: "POST" };

    setSyncingMode(mode);
    setSyncFeedback(undefined);
    setAnnouncement(mode === "backfill" ? "Backfill requested." : "Incremental sync requested.");

    try {
      const response = await fetch(endpoint, init);
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? `Sync failed (${response.status})`);
      }

      clearCache();
      await Promise.allSettled([
        loadPrices(true),
        loadEvents(true),
        loadImpacts(true),
        loadCorrelations(true),
        loadStatus(true),
        loadForward(true),
      ]);

      const completionMessage = mode === "backfill" ? "Backfill complete." : "Incremental sync complete.";
      setSyncFeedback(completionMessage);
      setAnnouncement(completionMessage);
    } catch (error) {
      const message = readableError(error, mode === "backfill" ? "Backfill failed." : "Incremental sync failed.");
      setSyncFeedback(message);
      setAnnouncement(message);
    } finally {
      setSyncingMode(null);
    }
  }, [loadCorrelations, loadEvents, loadForward, loadImpacts, loadPrices, loadStatus, syncingMode]);

  useEffect(() => {
    const root = document.documentElement;
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme: Theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
    root.dataset.theme = nextTheme;
    setTheme(nextTheme);

    const parsed = parseUrlState(window.location.search, routeView);
    if (parsed.controls.route !== routeView) {
      const redirectedSearch = buildSearchParams(parsed.filters, {
        ...parsed.controls,
        route: parsed.controls.route,
      }).toString();
      const redirectedUrl = `${VIEW_PATHS[parsed.controls.route]}?${redirectedSearch}${window.location.hash}`;
      window.location.replace(redirectedUrl);
      return;
    }

    setDraftFilters(parsed.filters);
    setAppliedFilters(parsed.filters);
    setControls({ ...parsed.controls, route: routeView });
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
    setAnnouncement("View refreshed for applied filters.");
  }, [appliedFilters, hydrated, refreshCurrentView]);

  useEffect(() => {
    if (!hydrated) return;

    const nextSearch = buildSearchParams(appliedFilters, {
      ...controls,
      route: routeView,
    }).toString();

    const nextUrl = `${VIEW_PATHS[routeView]}?${nextSearch}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [appliedFilters, controls, hydrated, routeView]);

  useEffect(() => {
    if (!hydrated) return;

    const onPopState = () => {
      const parsed = parseUrlState(window.location.search, routeView);
      if (parsed.controls.route !== routeView) {
        const redirectedSearch = buildSearchParams(parsed.filters, {
          ...parsed.controls,
          route: parsed.controls.route,
        }).toString();
        const redirectedUrl = `${VIEW_PATHS[parsed.controls.route]}?${redirectedSearch}${window.location.hash}`;
        window.location.replace(redirectedUrl);
        return;
      }

      setDraftFilters(parsed.filters);
      setAppliedFilters(parsed.filters);
      setControls({ ...parsed.controls, route: routeView });
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

  useEffect(() => {
    setVisibleChartTickers((previous) => {
      const allowed = new Set(appliedFilters.tickers);
      const kept = previous.filter((ticker) => allowed.has(ticker));
      if (kept.length > 0) return kept;
      return [...appliedFilters.tickers];
    });
  }, [appliedFilters.tickers]);

  useEffect(() => {
    const currentTop = topOpportunity(forwardState.data?.topSignals ?? []);
    const delta = computeOpportunityDelta(currentTop, previousTopRef.current);
    setOpportunityDelta(delta);
    previousTopRef.current = currentTop;
  }, [forwardState.data]);

  function updateDraft(partial: Partial<DraftFilters>) {
    setDraftFilters((previous) => ({ ...previous, ...partial }));
  }

  function updatePanel(panel: PanelKey) {
    setControls((previous) => ({ ...previous, panel }));
  }

  function updateFocusLab(focusLab: string | undefined) {
    setControls((previous) => ({ ...previous, focusLab, panel: "tape", page: 1 }));
  }

  function updateFocusTicker(focusTicker: string | undefined) {
    setControls((previous) => ({ ...previous, focusTicker, panel: "tape", page: 1 }));
  }

  function updateWindow(window: FocusWindow) {
    setControls((previous) => ({ ...previous, window, panel: "timeline" }));
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
    setAnnouncement("Draft filters reset. Apply to refresh results.");
  }

  function refreshView() {
    clearCache();
    refreshCurrentView(true);
    setAnnouncement("Manual refresh requested.");
  }

  const isBusy =
    routeView === "signals"
      ? eventsState.loading || forwardState.loading || statusState.loading || Boolean(syncingMode)
      : routeView === "context"
        ? pricesState.loading || eventsState.loading || statusState.loading || forwardState.loading || Boolean(syncingMode)
        : eventsState.loading || impactsState.loading || correlationsState.loading || statusState.loading || Boolean(syncingMode);

  const latestEventDate = (eventsState.data?.events ?? []).reduce<string>((latest, event) => event.publishedAt > latest ? event.publishedAt : latest, "");
  const latestRunSummary = syncingMode
    ? `${syncingMode} · running`
    : statusState.data?.latestRun
      ? `${statusState.data.latestRun.type} · ${statusState.data.latestRun.success ? "success" : "failed"} · ${formatDateTime(statusState.data.latestRun.createdAt)}`
      : "No pipeline run metadata yet";
  const pipelineMessage = syncingMode
    ? syncingMode === "backfill"
      ? `Backfill in progress from ${DEFAULT_FROM_DATE}. Prices, events, and derived analytics are being rebuilt.`
      : "Incremental sync in progress for the rolling one-year window."
    : syncFeedback
      ? syncFeedback
      : statusState.data?.latestRun
        ? `Latest run: ${latestRunSummary}`
        : `No data has been ingested yet. Start with Backfill ${DEFAULT_FROM_DATE}+ to populate the desk.`;

  const navLinks = [
    { route: "signals" as const, label: "Signals", note: "Lead calls and relative-value ideas", icon: Activity },
    { route: "context" as const, label: "Context", note: "Tape, overlays, and catalyst chronology", icon: Orbit },
    { route: "diagnostics" as const, label: "Diagnostics", note: "Evidence tables and source reliability", icon: FlaskConical },
  ];

  const masthead = (
    <Masthead
      eyebrow="Hyperscaler Investment"
      title="Midnight Editorial Desk"
      description="AI release timing, hyperscaler reaction, and source reliability arranged as a newsroom-grade analyst workstation."
      summaryItems={[
        {
          label: "Coverage window",
          value: `${appliedFilters.from} to ${appliedFilters.to}`,
        },
        {
          label: "Latest event",
          value: latestEventDate ? formatDate(latestEventDate) : "Awaiting event feed",
        },
        {
          label: "Pipeline",
          value: latestRunSummary,
        },
      ]}
      hasUnsavedChanges={hasUnsavedChanges}
      isBusy={isBusy}
      theme={theme}
      onToggleTheme={() => setTheme((previous) => (previous === "dark" ? "light" : "dark"))}
      onRefresh={refreshView}
    />
  );

  const routeRail = (
    <RouteRail
      title="Desk routes"
      description="Move between signal generation, market tape context, and the evidence log without losing your active scope."
      links={navLinks.map((link) => ({
        ...link,
        href: createViewHref(link.route, appliedFilters, controls),
        active: link.route === routeView,
      }))}
    />
  );

  const filterDock = (
    <FilterDock
      eyebrow="Filter dock"
      title="Draft scope and execution preferences"
      description="Filter changes remain sandboxed until Apply. Sorting and density adjust the current route immediately."
      actions={
        <>
          <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={applyFilters}>Apply</button>
          <button type="button" className={`${styles.button} ${styles.buttonQuiet}`} onClick={resetFilters}>Reset</button>
        </>
      }
      footer={
        <p className={styles.appliedSummary}>
          Applied scope <span className={styles.mono}>{appliedFilters.from} to {appliedFilters.to}</span>
          {statusState.data?.latestRun ? ` · Last run ${statusState.data.latestRun.type} (${statusState.data.latestRun.success ? "success" : "failed"})` : ""}
        </p>
      }
    >
      <div className={styles.controlMatrix}>
        <section className={styles.controlBand}>
          <div className={styles.bandHeader}>
            <p className={styles.bandTitle}>Pipeline</p>
            <p className={styles.bandNote}>Bootstrap the dataset, then refresh recent observations without leaving the dashboard.</p>
          </div>

          <div className={styles.actionRow}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonAccent}`}
              onClick={() => void runSync("backfill")}
              disabled={Boolean(syncingMode)}
            >
              {syncingMode === "backfill" ? "Backfilling..." : `Backfill ${DEFAULT_FROM_DATE}+`}
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonQuiet}`}
              onClick={() => void runSync("incremental")}
              disabled={Boolean(syncingMode)}
            >
              {syncingMode === "incremental" ? "Refreshing..." : "Incremental"}
            </button>
          </div>

          <p className={styles.smallHelp}>{pipelineMessage}</p>
        </section>

        <section className={styles.controlBand}>
          <div className={styles.bandHeader}>
            <p className={styles.bandTitle}>Window</p>
            <p className={styles.bandNote}>Date boundaries for events, prices, and downstream studies.</p>
          </div>

          <div className={styles.dualFields}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>From</span>
              <input className={styles.input} type="date" value={draftFilters.from} onChange={(event) => updateDraft({ from: event.target.value })} />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>To</span>
              <input className={styles.input} type="date" value={draftFilters.to} onChange={(event) => updateDraft({ to: event.target.value })} />
            </label>
          </div>
        </section>

        <section className={styles.controlBand}>
          <div className={styles.bandHeader}>
            <p className={styles.bandTitle}>Signal trim</p>
            <p className={styles.bandNote}>Confidence threshold and source provenance guardrails.</p>
          </div>

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
            <span id="min-confidence-value" className={clsx(styles.smallHelp, styles.rangeValue, styles.mono)}>
              {draftFilters.minConfidence.toFixed(2)}
            </span>
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
        </section>

        <section className={styles.controlBand}>
          <div className={styles.bandHeader}>
            <p className={styles.bandTitle}>View settings</p>
            <p className={styles.bandNote}>Route-level ordering and reading density.</p>
          </div>

          <div className={styles.dualFields}>
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
          </div>
        </section>

        <section className={`${styles.controlBand} ${styles.controlBandWide}`}>
          <div className={styles.bandHeader}>
            <p className={styles.bandTitle}>Lab coverage</p>
            <p className={styles.bandNote}>Select at least one model lab to keep signal generation valid.</p>
          </div>

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
        </section>

        <section className={`${styles.controlBand} ${styles.controlBandWide}`}>
          <div className={styles.bandHeader}>
            <p className={styles.bandTitle}>Ticker basket</p>
            <p className={styles.bandNote}>Universe of hyperscaler names used across tape and event-study views.</p>
          </div>

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
        </section>
      </div>
    </FilterDock>
  );

  return (
    <main className={styles.root} aria-busy={isBusy}>
      <a className={styles.skipLink} href="#dashboard-main">Skip to dashboard content</a>
      <p className="sr-only" aria-live="polite">{announcement}</p>

      <div className={styles.app}>
        <DashboardChrome masthead={masthead} routeRail={routeRail} filterDock={filterDock}>
          <div id="dashboard-main" className={styles.content} tabIndex={-1}>
            {routeView === "signals" && (
              <SignalsView
                sort={controls.sort}
                density={controls.density}
                page={controls.page}
                onPageChange={(page) => setControls((previous) => ({ ...previous, page: Math.max(1, page) }))}
                onSetPanel={updatePanel}
                displayTicker={displayTicker}
                forwardState={forwardState}
                statusState={statusState}
                opportunityDelta={opportunityDelta}
                onRetryForward={() => void loadForward(true)}
                onRetryStatus={() => void loadStatus(true)}
              />
            )}

            {routeView === "context" && (
              <ContextView
                isMounted={isMounted}
                sort={controls.sort}
                filters={appliedFilters}
                focusLab={controls.focusLab}
                focusTicker={controls.focusTicker}
                window={controls.window ?? "1w"}
                onFocusLabChange={updateFocusLab}
                onFocusTickerChange={updateFocusTicker}
                onWindowChange={updateWindow}
                onSetPanel={updatePanel}
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

            {routeView === "diagnostics" && (
              <DiagnosticsView
                sort={controls.sort}
                density={controls.density}
                page={controls.page}
                onPageChange={(page) => setControls((previous) => ({ ...previous, page: Math.max(1, page) }))}
                onSetPanel={updatePanel}
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
        </DashboardChrome>
      </div>
    </main>
  );
}
