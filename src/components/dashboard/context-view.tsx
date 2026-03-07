"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import clsx from "clsx";
import { HYPERSCALER_TICKERS, LABS } from "@/lib/config";
import shared from "@/components/dashboard/dashboard.module.css";
import styles from "@/components/dashboard/context-view.module.css";
import { CatalystTimeline } from "@/components/dashboard/catalyst-timeline";
import type {
  AppliedFilters,
  DashboardSort,
  EventResponse,
  ForwardSignalsResponse,
  FocusWindow,
  LoadState,
  PanelKey,
  PriceResponse,
  StatusResponse,
} from "@/components/dashboard/types";
import {
  composeWhyNowNarrative,
  sortEvents,
  summarizeChart,
} from "@/components/dashboard/utils";

const LINE_PATTERNS = ["0", "6 4", "2 5", "10 5", "4 2", "12 4 2 4", "8 2", "3 3"];

type ContextViewProps = {
  isMounted: boolean;
  sort: DashboardSort;
  filters: AppliedFilters;
  focusLab?: string;
  focusTicker?: string;
  window: FocusWindow;
  onFocusLabChange: (focusLab: string | undefined) => void;
  onFocusTickerChange: (focusTicker: string | undefined) => void;
  onWindowChange: (window: FocusWindow) => void;
  onSetPanel: (panel: PanelKey) => void;
  pricesState: LoadState<PriceResponse>;
  eventsState: LoadState<EventResponse>;
  statusState: LoadState<StatusResponse>;
  forwardState: LoadState<ForwardSignalsResponse>;
  selectedTickers: string[];
  visibleTickers: string[];
  onToggleTicker: (ticker: string) => void;
  displayTicker: (ticker: string) => string;
  onRetryPrices: () => void;
  onRetryEvents: () => void;
  onRetryStatus: () => void;
  onRetryForward: () => void;
};

export function ContextView({
  isMounted,
  sort,
  filters,
  focusLab,
  focusTicker,
  window,
  onFocusLabChange,
  onFocusTickerChange,
  onWindowChange,
  onSetPanel,
  pricesState,
  eventsState,
  statusState,
  forwardState,
  selectedTickers,
  visibleTickers,
  onToggleTicker,
  displayTicker,
  onRetryPrices,
  onRetryEvents,
  onRetryStatus,
  onRetryForward,
}: ContextViewProps) {
  const events = sortEvents(eventsState.data?.events ?? [], sort);
  const scopedEvents = focusLab ? events.filter((event) => event.labId === focusLab) : events;
  const eventLines = scopedEvents.filter((event) => event.effectiveTradingDate).slice(0, 120);

  const officialCount = scopedEvents.filter((event) => event.sourceTier === "official").length;
  const fallbackCount = scopedEvents.filter((event) => event.sourceTier === "fallback").length;
  const totalCount = scopedEvents.length;

  const labCounts = scopedEvents.reduce<Record<string, number>>((acc, event) => {
    acc[event.lab.name] = (acc[event.lab.name] ?? 0) + 1;
    return acc;
  }, {});
  const [topLab, topLabCount] = Object.entries(labCounts).sort((left, right) => right[1] - left[1])[0] ?? ["-", 0];

  const focusTickerInChart = focusTicker ? visibleTickers.includes(focusTicker) : true;
  const chartSummary = summarizeChart(pricesState.data?.points ?? [], visibleTickers);
  const whyNow = composeWhyNowNarrative(forwardState.data, filters, focusLab, focusTicker);

  const lineColors = ["#5bd8ff", "#f0b16a", "#78d8b2", "#ff94a5", "#9fb4ff", "#e9d77a", "#caa2ff", "#7fe6d1"];

  return (
    <>
      <nav className={shared.sectionNav} aria-label="Context sections">
        <a className={shared.sectionLink} href="#context-tape" onClick={() => onSetPanel("tape")}>Market Tape</a>
        <a className={shared.sectionLink} href="#context-timeline" onClick={() => onSetPanel("timeline")}>Catalyst Timeline</a>
        <a className={shared.sectionLink} href="#context-composition" onClick={() => onSetPanel("quality")}>Composition</a>
      </nav>

      <section id="context-tape" className={`${shared.anchorTarget} ${styles.chartPanel} ${shared.reveal}`}>
        <div className={styles.chartHeaderRow}>
          <div>
            <h2 className={shared.title}>Market Tape With Catalyst Overlays</h2>
            <p className={shared.subtitle}>Price context first. Read the tape, then inspect release cadence and event markers inside the same frame.</p>
          </div>
          <div className={styles.chartMeta}>
            <span className={styles.releaseBadge}>{eventLines.length} release markers</span>
          </div>
        </div>

        <p className={styles.chartLead}>{chartSummary}</p>

        <div className={styles.chartToolbar}>
          <div className={styles.focusRow}>
            <label className={styles.focusField}>
              <span className={styles.focusLabel}>Focus Lab</span>
              <select
                className={styles.focusSelect}
                value={focusLab ?? ""}
                onChange={(event) => onFocusLabChange(event.target.value || undefined)}
              >
                <option value="">All labs</option>
                {LABS.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            </label>

            <label className={styles.focusField}>
              <span className={styles.focusLabel}>Focus Ticker</span>
              <select
                className={styles.focusSelect}
                value={focusTicker ?? ""}
                onChange={(event) => onFocusTickerChange(event.target.value || undefined)}
              >
                <option value="">All tickers</option>
                {HYPERSCALER_TICKERS.map((ticker) => (
                  <option key={ticker.ticker} value={ticker.ticker}>{displayTicker(ticker.ticker)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.legendBlock}>
            <p className={styles.legendLabel}>Visible series</p>
            <div className={styles.legendRow} role="group" aria-label="Toggle chart series">
              {selectedTickers.map((ticker, index) => {
                const active = visibleTickers.includes(ticker);
                return (
                  <button
                    key={ticker}
                    type="button"
                    className={clsx(styles.legendChip, active && styles.legendChipActive)}
                    onClick={() => onToggleTicker(ticker)}
                    aria-pressed={active}
                  >
                    <span className={styles.legendSwatch} style={{ background: lineColors[index % lineColors.length] }} />
                    {displayTicker(ticker)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {focusTicker && !focusTickerInChart && (
          <p className={styles.timelineEmpty}>
            Focus ticker {displayTicker(focusTicker)} is currently hidden from the chart. Re-enable that series to inspect its trend.
          </p>
        )}

        {pricesState.error && (
          <div className={shared.alert} role="alert">
            {pricesState.error}
            <div className={shared.actionRow}>
              <button type="button" className={`${shared.button} ${shared.buttonQuiet}`} onClick={onRetryPrices}>Retry Market Tape</button>
            </div>
          </div>
        )}

        <div className={styles.chartWrap} style={{ height: 360 }} role="img" aria-label="Market tape with catalyst overlays">
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pricesState.data?.points ?? []} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--plot-grid)" />
                <XAxis dataKey="date" minTickGap={32} stroke="var(--plot-grid)" tick={{ fill: "var(--plot-axis)", fontSize: 12 }} />
                <YAxis stroke="var(--plot-grid)" tick={{ fill: "var(--plot-axis)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-panel)",
                    borderColor: "var(--line-strong)",
                    borderRadius: "1rem",
                    color: "var(--ink-primary)",
                  }}
                  labelStyle={{ color: "var(--ink-secondary)" }}
                />
                {visibleTickers.map((ticker, index) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    name={displayTicker(ticker)}
                    stroke={lineColors[index % lineColors.length]}
                    strokeDasharray={LINE_PATTERNS[index % LINE_PATTERNS.length]}
                    strokeWidth={2.2}
                    dot={false}
                  />
                ))}
                {eventLines.map((event) => (
                  <ReferenceLine
                    key={event.id}
                    x={event.effectiveTradingDate?.slice(0, 10)}
                    stroke={event.sourceTier === "official" ? "var(--signal-accent)" : "var(--signal-fallback)"}
                    strokeOpacity={0.45}
                    strokeDasharray="4 6"
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className={shared.empty}>Preparing chart...</p>
          )}
        </div>
      </section>

      <div className={styles.contextGrid}>
        <section id="context-timeline" className={`${shared.anchorTarget} ${styles.timelinePanel} ${shared.revealDelayed}`}>
          <div className={shared.panelHeader}>
            <div>
              <h2 className={shared.title}>Catalyst Timeline</h2>
              <p className={shared.subtitle}>Grouped release cadence for day/week/month workflow checks. Use focus controls to isolate one lab quickly.</p>
            </div>
            <p className={shared.smallHelp}>{scopedEvents.length} catalysts in view</p>
          </div>

          {eventsState.error && (
            <div className={shared.alert} role="alert">
              {eventsState.error}
              <div className={shared.actionRow}>
                <button type="button" className={`${shared.button} ${shared.buttonQuiet}`} onClick={onRetryEvents}>Retry Timeline Data</button>
              </div>
            </div>
          )}

          <CatalystTimeline events={scopedEvents} focusLab={focusLab} window={window} onWindowChange={onWindowChange} />
        </section>

        <aside id="context-composition" className={`${shared.anchorTarget} ${styles.notePanel} ${shared.revealDelayed}`}>
          <p className={styles.noteEyebrow}>Intelligence note</p>
          <div className={shared.panelHeader}>
            <div>
              <h2 className={shared.title}>Event composition and narrative</h2>
              <p className={styles.noteLead}>Source mix, lab concentration, and what changed enough to matter now.</p>
            </div>
          </div>

          {(statusState.error || forwardState.error) && (
            <div className={shared.alert} role="alert">
              {statusState.error ?? forwardState.error}
              <div className={shared.actionRow}>
                {statusState.error && <button type="button" className={`${shared.button} ${shared.buttonQuiet}`} onClick={onRetryStatus}>Retry Source Reliability</button>}
                {forwardState.error && <button type="button" className={`${shared.button} ${shared.buttonQuiet}`} onClick={onRetryForward}>Retry Signal Context</button>}
              </div>
            </div>
          )}

          <div className={styles.compositionGrid}>
            <article className={styles.compositionTile}>
              <p className={styles.compositionLabel}>Official vs fallback</p>
              <p className={styles.compositionValue}>{officialCount}/{totalCount || 0}</p>
              <p className={styles.compositionNote}>{fallbackCount} fallback events in current scope</p>
            </article>

            <article className={styles.compositionTile}>
              <p className={styles.compositionLabel}>Top lab concentration</p>
              <p className={styles.compositionValue}>{topLabCount}</p>
              <p className={styles.compositionNote}>{topLab} contributes the most catalysts in this window</p>
            </article>

            <article className={styles.compositionTile}>
              <p className={styles.compositionLabel}>Latest pipeline run</p>
              <p className={styles.compositionValue}>{statusState.data?.latestRun?.type ?? "none"}</p>
              <p className={styles.compositionNote}>{statusState.data?.latestRun ? (statusState.data.latestRun.success ? "Successful" : "Failed") : "No run metadata yet"}</p>
            </article>
          </div>

          <p className={styles.narrativeCallout}>{whyNow}</p>
        </aside>
      </div>
    </>
  );
}
