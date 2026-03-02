"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "@/components/dashboard/dashboard.module.css";
import type {
  DashboardSort,
  DensityMode,
  EventResponse,
  ForwardSignalsResponse,
  LoadState,
  PriceResponse,
  StatusResponse,
} from "@/components/dashboard/types";
import {
  confidenceBadgeClass,
  formatDate,
  formatDateTime,
  paginate,
  sortForwardSignals,
  summarizeChart,
} from "@/components/dashboard/utils";

const LINE_COLORS = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#1f78b4"];
const LINE_PATTERNS = ["0", "6 4", "2 4", "10 4", "4 2", "12 4 2 4", "8 2", "3 3"];

type OverviewViewProps = {
  isMounted: boolean;
  sort: DashboardSort;
  density: DensityMode;
  page: number;
  onPageChange: (page: number) => void;
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

export function OverviewView({
  isMounted,
  sort,
  density,
  page,
  onPageChange,
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
}: OverviewViewProps) {
  const forwardSignals = forwardState.data?.topSignals ?? [];
  const sortedSignals = sortForwardSignals(forwardSignals, sort);
  const pageSize = density === "compact" ? 8 : 5;
  const { totalPages, currentPage, pageItems } = paginate(sortedSignals, page, pageSize);

  const events = eventsState.data?.events ?? [];
  const eventLines = events.filter((event) => event.effectiveTradingDate).slice(0, 100);

  const healthySources = (statusState.data?.sources ?? []).filter((source) => source.lastSuccessAt).length;
  const sourceCount = statusState.data?.sources.length ?? 0;
  const officialEvents = events.filter((event) => event.sourceTier === "official").length;
  const actionableSignals = forwardSignals.filter((signal) => signal.actionable).length;
  const chartSummary = summarizeChart(pricesState.data?.points ?? [], visibleTickers);

  return (
    <>
      <nav className={styles.sectionNav} aria-label="Overview sections">
        <a className={styles.sectionLink} href="#overview-kpis">KPIs</a>
        <a className={styles.sectionLink} href="#overview-market-tape">Market Tape</a>
        <a className={styles.sectionLink} href="#overview-top-signals">Top Signals</a>
      </nav>

      <section id="overview-kpis" className={`${styles.grid4}`}>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Events In Scope</p>
          <p className={`${styles.metricValue} ${styles.mono}`}>{events.length}</p>
          <p className={styles.metricNote}>{officialEvents} official source events</p>
        </article>

        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Actionable Signals</p>
          <p className={`${styles.metricValue} ${styles.mono}`}>{actionableSignals}</p>
          <p className={styles.metricNote}>{forwardSignals.length} modeled signals</p>
        </article>

        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Source Health</p>
          <p className={`${styles.metricValue} ${styles.mono}`}>{healthySources}/{sourceCount}</p>
          <p className={styles.metricNote}>sources with latest successful run</p>
        </article>

        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Latest Sync</p>
          <p className={`${styles.metricValue} ${styles.mono}`}>
            {statusState.data?.latestRun ? statusState.data.latestRun.type : "none"}
          </p>
          <p className={styles.metricNote}>
            {formatDateTime(statusState.data?.latestRun?.createdAt ?? null)}
          </p>
        </article>
      </section>

      <section id="overview-market-tape" className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.title}>Market Tape</h2>
            <p className={styles.subtitle}>Normalized price overlays with release markers and explicit text summary for quick scan.</p>
          </div>
          <p className={styles.smallHelp}>{eventLines.length} release markers</p>
        </div>

        <div className={`${styles.chipGroup}`} role="group" aria-label="Toggle chart series">
          {selectedTickers.map((ticker, index) => {
            const active = visibleTickers.includes(ticker);
            return (
            <button
              key={ticker}
              type="button"
              className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => onToggleTicker(ticker)}
              aria-pressed={active}
            >
              <span className={styles.legendSwatch} style={{ background: LINE_COLORS[index % LINE_COLORS.length] }} />
              {displayTicker(ticker)}
            </button>
            );
          })}
        </div>

        {pricesState.error && (
          <div className={styles.alert} role="alert">
            {pricesState.error}
            <div className={styles.actionRow}>
              <button type="button" className={`${styles.button} ${styles.buttonQuiet}`} onClick={onRetryPrices}>Retry Market Tape</button>
            </div>
          </div>
        )}

        <div className={styles.tableWrap} style={{ height: 360 }} role="img" aria-label="Market tape chart">
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pricesState.data?.points ?? []} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--plot-grid)" />
                <XAxis dataKey="date" minTickGap={32} stroke="var(--plot-grid)" tick={{ fill: "var(--plot-axis)", fontSize: 12 }} />
                <YAxis stroke="var(--plot-grid)" tick={{ fill: "var(--plot-axis)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-raised)",
                    borderColor: "var(--line-strong)",
                    borderRadius: "0.75rem",
                    color: "var(--ink-primary)",
                  }}
                  labelStyle={{ color: "var(--ink-secondary)" }}
                />
                <Legend wrapperStyle={{ color: "var(--ink-secondary)", fontSize: "12px" }} />
                {visibleTickers.map((ticker, index) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    name={displayTicker(ticker)}
                    stroke={LINE_COLORS[index % LINE_COLORS.length]}
                    strokeDasharray={LINE_PATTERNS[index % LINE_PATTERNS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
                {eventLines.map((event) => (
                  <ReferenceLine
                    key={event.id}
                    x={event.effectiveTradingDate?.slice(0, 10)}
                    stroke={event.sourceTier === "official" ? "var(--signal-accent)" : "var(--signal-fallback)"}
                    strokeOpacity={0.35}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.empty}>Preparing chart...</p>
          )}
        </div>

        <p className={styles.chartSummary}>{chartSummary}</p>
      </section>

      <section id="overview-top-signals" className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.title}>Top Signals</h2>
            <p className={styles.subtitle}>CAR means cumulative abnormal return. Signal rate measures post-release consistency.</p>
          </div>
          <p className={styles.smallHelp}>As of {formatDate(forwardState.data?.asOf ?? "")}</p>
        </div>

        {forwardState.error && (
          <div className={styles.alert} role="alert">
            {forwardState.error}
            <div className={styles.actionRow}>
              <button type="button" className={`${styles.button} ${styles.buttonQuiet}`} onClick={onRetryForward}>Retry Signals</button>
            </div>
          </div>
        )}

        <div className={`${styles.tableWrap} ${density === "compact" ? styles.densityCompact : styles.densityCozy}`}>
          <table className={styles.table}>
            <caption className="sr-only">Ranked forward signals</caption>
            <thead className={styles.tableHead}>
              <tr>
                <th scope="col">Lab</th>
                <th scope="col">Ticker</th>
                <th scope="col">Bias</th>
                <th scope="col">Avg CAR</th>
                <th scope="col">Sig Rate</th>
                <th scope="col">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6}><p className={styles.empty}>No forward signals for these filters. Apply broader filters or sync data.</p></td>
                </tr>
              ) : (
                pageItems.map((signal) => (
                  <tr key={`${signal.labId}-${signal.ticker}`}>
                    <th scope="row">{signal.labName}</th>
                    <td>{displayTicker(signal.ticker)}</td>
                    <td className={signal.direction === "long-bias" ? "tone-positive" : "tone-negative"}>{signal.direction === "long-bias" ? "Long" : "Short"}</td>
                    <td className={styles.mono}>{signal.avgCarPct.toFixed(2)}%</td>
                    <td className={styles.mono}>{signal.sigRatePct.toFixed(1)}%</td>
                    <td><span className={`badge ${confidenceBadgeClass(signal.confidenceBand)}`}>{(signal.confidenceScore * 100).toFixed(0)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <button type="button" className={styles.pageButton} onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>Previous</button>
          <p className={styles.pageInfo}>Page {currentPage} of {totalPages}</p>
          <button type="button" className={styles.pageButton} onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>Next</button>
        </div>
      </section>

      {(eventsState.error || statusState.error) && (
        <section className={styles.panel}>
          <h2 className={styles.title}>Background Data Recovery</h2>
          <div className={styles.actionRow}>
            {eventsState.error && <button type="button" className={`${styles.button} ${styles.buttonQuiet}`} onClick={onRetryEvents}>Retry Events Feed</button>}
            {statusState.error && <button type="button" className={`${styles.button} ${styles.buttonQuiet}`} onClick={onRetryStatus}>Retry Source Health</button>}
          </div>
        </section>
      )}
    </>
  );
}
