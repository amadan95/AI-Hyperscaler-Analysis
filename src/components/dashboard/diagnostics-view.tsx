"use client";

import styles from "@/components/dashboard/dashboard.module.css";
import type {
  CorrelationResponse,
  DashboardSort,
  DensityMode,
  EventResponse,
  EventStudyResponse,
  LoadState,
  StatusResponse,
} from "@/components/dashboard/types";
import {
  correlationCellClass,
  formatDate,
  formatDateTime,
  formatPercent,
  paginate,
  sortCorrelations,
  sortEventImpacts,
  sortEvents,
} from "@/components/dashboard/utils";

type DiagnosticsViewProps = {
  sort: DashboardSort;
  density: DensityMode;
  page: number;
  onPageChange: (page: number) => void;
  displayTicker: (ticker: string) => string;
  eventsState: LoadState<EventResponse>;
  impactsState: LoadState<EventStudyResponse>;
  correlationsState: LoadState<CorrelationResponse>;
  statusState: LoadState<StatusResponse>;
  onRetryEvents: () => void;
  onRetryImpacts: () => void;
  onRetryCorrelations: () => void;
  onRetryStatus: () => void;
};

export function DiagnosticsView({
  sort,
  density,
  page,
  onPageChange,
  displayTicker,
  eventsState,
  impactsState,
  correlationsState,
  statusState,
  onRetryEvents,
  onRetryImpacts,
  onRetryCorrelations,
  onRetryStatus,
}: DiagnosticsViewProps) {
  const sortedEvents = sortEvents(eventsState.data?.events ?? [], sort);
  const { pageItems, currentPage, totalPages } = paginate(sortedEvents, page, density === "compact" ? 18 : 12);
  const sortedImpacts = sortEventImpacts(impactsState.data?.impacts ?? [], sort).slice(0, 120);
  const sortedCorrelations = sortCorrelations(correlationsState.data?.correlations ?? []);

  const groupedCorrelations = new Map<string, Map<number, number>>();
  for (const metric of sortedCorrelations) {
    const key = `${metric.lab.name} / ${displayTicker(metric.ticker)}`;
    if (!groupedCorrelations.has(key)) {
      groupedCorrelations.set(key, new Map<number, number>());
    }
    groupedCorrelations.get(key)?.set(metric.lagDays, metric.correlation);
  }

  return (
    <>
      <nav className={styles.sectionNav} aria-label="Diagnostics sections">
        <a className={styles.sectionLink} href="#diag-event-study">Event Study</a>
        <a className={styles.sectionLink} href="#diag-correlation">Lag Correlation</a>
        <a className={styles.sectionLink} href="#diag-events">Recent Events</a>
        <a className={styles.sectionLink} href="#diag-quality">Source Health</a>
      </nav>

      <section id="diag-event-study" className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.title}>Event Study</h2>
            <p className={styles.subtitle}>CAR means cumulative abnormal return versus benchmark expectation.</p>
          </div>
        </div>

        {impactsState.error && (
          <div className={styles.alert} role="alert">
            {impactsState.error}
            <div className={styles.actionRow}>
              <button type="button" className={`${styles.button} ${styles.buttonQuiet}`} onClick={onRetryImpacts}>Retry Event Study</button>
            </div>
          </div>
        )}

        <div className={`${styles.tableWrap} ${density === "compact" ? styles.densityCompact : styles.densityCozy}`}>
          <table className={styles.table}>
            <caption className="sr-only">Event study impacts</caption>
            <thead className={styles.tableHead}>
              <tr>
                <th scope="col">Lab</th>
                <th scope="col">Ticker</th>
                <th scope="col">Window</th>
                <th scope="col">CAR</th>
                <th scope="col">P-value</th>
              </tr>
            </thead>
            <tbody>
              {sortedImpacts.length === 0 ? (
                <tr>
                  <td colSpan={5}><p className={styles.empty}>No event-study rows for this filter set.</p></td>
                </tr>
              ) : (
                sortedImpacts.map((impact) => (
                  <tr key={impact.id}>
                    <th scope="row">{impact.event.lab.name}</th>
                    <td>{displayTicker(impact.ticker)}</td>
                    <td className={styles.mono}>±{impact.window}d</td>
                    <td className={styles.mono}>{formatPercent(impact.car)}</td>
                    <td className={styles.mono}>{impact.pValue.toFixed(3)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="diag-correlation" className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.title}>Lag Correlation Heatmap</h2>
            <p className={styles.subtitle}>Correlation values by lag days. Colors are paired with numeric values for accessibility.</p>
          </div>
        </div>

        {correlationsState.error && (
          <div className={styles.alert} role="alert">
            {correlationsState.error}
            <div className={styles.actionRow}>
              <button type="button" className={`${styles.button} ${styles.buttonQuiet}`} onClick={onRetryCorrelations}>Retry Correlation</button>
            </div>
          </div>
        )}

        <div className={`${styles.tableWrap} ${density === "compact" ? styles.densityCompact : styles.densityCozy}`}>
          <table className={styles.table}>
            <caption className="sr-only">Lag correlation matrix</caption>
            <thead className={styles.tableHead}>
              <tr>
                <th scope="col">Lab / Ticker</th>
                <th scope="col">Lag 0</th>
                <th scope="col">Lag 1</th>
                <th scope="col">Lag 3</th>
                <th scope="col">Lag 7</th>
              </tr>
            </thead>
            <tbody>
              {groupedCorrelations.size === 0 ? (
                <tr>
                  <td colSpan={5}><p className={styles.empty}>No lag-correlation rows for this filter set.</p></td>
                </tr>
              ) : (
                Array.from(groupedCorrelations.entries()).map(([key, lagMap]) => (
                  <tr key={key}>
                    <th scope="row">{key}</th>
                    {[0, 1, 3, 7].map((lag) => {
                      const value = lagMap.get(lag) ?? 0;
                      return (
                        <td key={lag} className={`${styles.mono} ${correlationCellClass(value)}`}>
                          {value.toFixed(3)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="diag-events" className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.title}>Recent Events</h2>
            <p className={styles.subtitle}>Raw catalyst feed. Use this table to validate source quality and date coverage.</p>
          </div>
        </div>

        {eventsState.error && (
          <div className={styles.alert} role="alert">
            {eventsState.error}
            <div className={styles.actionRow}>
              <button type="button" className={`${styles.button} ${styles.buttonQuiet}`} onClick={onRetryEvents}>Retry Events</button>
            </div>
          </div>
        )}

        <div className={`${styles.tableWrap} ${density === "compact" ? styles.densityCompact : styles.densityCozy}`}>
          <table className={styles.table}>
            <caption className="sr-only">Recent events feed</caption>
            <thead className={styles.tableHead}>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Lab</th>
                <th scope="col">Confidence</th>
                <th scope="col">Headline</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={4}><p className={styles.empty}>No events found for this filter set.</p></td>
                </tr>
              ) : (
                pageItems.map((event) => (
                  <tr key={event.id}>
                    <th scope="row" className={styles.mono}>{formatDate(event.publishedAt)}</th>
                    <td>{event.lab.name}</td>
                    <td className={styles.mono}>{event.confidence.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${event.sourceTier === "official" ? "badge-official" : "badge-fallback"}`}>{event.sourceTier}</span>{" "}
                      <a href={event.url} target="_blank" rel="noreferrer" className="inline-link">
                        {event.title}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </td>
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

      <section id="diag-quality" className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.title}>Data Quality</h2>
            <p className={styles.subtitle}>Latest run and source reliability. Errors are isolated with local retry actions.</p>
          </div>
          <p className={styles.smallHelp}>Latest run: {statusState.data?.latestRun ? `${statusState.data.latestRun.type} (${statusState.data.latestRun.success ? "success" : "failed"})` : "none"}</p>
        </div>

        {statusState.error && (
          <div className={styles.alert} role="alert">
            {statusState.error}
            <div className={styles.actionRow}>
              <button type="button" className={`${styles.button} ${styles.buttonQuiet}`} onClick={onRetryStatus}>Retry Source Health</button>
            </div>
          </div>
        )}

        <div className={`${styles.tableWrap} ${density === "compact" ? styles.densityCompact : styles.densityCozy}`}>
          <table className={styles.table}>
            <caption className="sr-only">Source health by lab</caption>
            <thead className={styles.tableHead}>
              <tr>
                <th scope="col">Lab</th>
                <th scope="col">Source</th>
                <th scope="col">Tier</th>
                <th scope="col">Events</th>
                <th scope="col">Last Success</th>
              </tr>
            </thead>
            <tbody>
              {(statusState.data?.sources ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5}><p className={styles.empty}>No source rows are available yet.</p></td>
                </tr>
              ) : (
                (statusState.data?.sources ?? []).map((source) => (
                  <tr key={source.id}>
                    <th scope="row">{source.lab.name}</th>
                    <td>{source.sourceName}</td>
                    <td><span className={`badge ${source.sourceTier === "official" ? "badge-official" : "badge-fallback"}`}>{source.sourceTier}</span></td>
                    <td className={styles.mono}>{source.eventCount}</td>
                    <td className={styles.mono}>{formatDateTime(source.lastSuccessAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
