"use client";

import shared from "@/components/dashboard/dashboard.module.css";
import styles from "@/components/dashboard/diagnostics-view.module.css";
import type {
  CorrelationResponse,
  DashboardSort,
  DensityMode,
  EventResponse,
  EventStudyResponse,
  LoadState,
  PanelKey,
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
  onSetPanel: (panel: PanelKey) => void;
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
  onSetPanel,
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
  const sortedImpacts = sortEventImpacts(impactsState.data?.impacts ?? [], sort).slice(0, 140);
  const sortedCorrelations = sortCorrelations(correlationsState.data?.correlations ?? []);

  const groupedCorrelations = new Map<string, Map<number, number>>();
  for (const metric of sortedCorrelations) {
    const key = `${metric.lab.name} / ${displayTicker(metric.ticker)}`;
    if (!groupedCorrelations.has(key)) {
      groupedCorrelations.set(key, new Map<number, number>());
    }
    groupedCorrelations.get(key)?.set(metric.lagDays, metric.correlation);
  }

  const sourceRows = statusState.data?.sources ?? [];
  const healthySources = sourceRows.filter((source) => source.lastSuccessAt).length;
  const failingSources = sourceRows.filter((source) => source.lastFailureAt).length;
  const officialSources = sourceRows.filter((source) => source.sourceTier === "official").length;

  return (
    <>
      <nav className={shared.sectionNav} aria-label="Diagnostics sections">
        <a className={shared.sectionLink} href="#diag-event-study" onClick={() => onSetPanel("event-study")}>Event Study</a>
        <a className={shared.sectionLink} href="#diag-correlation" onClick={() => onSetPanel("correlation")}>Lag Correlation</a>
        <a className={shared.sectionLink} href="#diag-quality" onClick={() => onSetPanel("quality")}>Source Reliability</a>
        <a className={shared.sectionLink} href="#diag-events" onClick={() => onSetPanel("events")}>Raw Event Feed</a>
      </nav>

      <section id="diag-event-study" className={`${shared.anchorTarget} ${shared.panel} ${shared.reveal}`}>
        <div className={shared.panelHeader}>
          <div>
            <h2 className={shared.title}>Event Study Table</h2>
            <p className={shared.subtitle}>Default sort is strongest CAR. CAR = cumulative abnormal return against benchmark expectation.</p>
          </div>
          <p className={shared.smallHelp}>{sortedImpacts.length} impacts available</p>
        </div>

        {impactsState.error && (
          <div className={shared.alert} role="alert">
            {impactsState.error}
            <div className={shared.actionRow}>
              <button type="button" className={`${shared.button} ${shared.buttonQuiet}`} onClick={onRetryImpacts}>Retry Event Study</button>
            </div>
          </div>
        )}

        <div className={`${shared.tableWrap} ${density === "compact" ? shared.densityCompact : shared.densityCozy}`}>
          <table className={shared.table}>
            <caption className="sr-only">Event-study impacts</caption>
            <thead className={shared.tableHead}>
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
                  <td colSpan={5}><p className={shared.empty}>No event-study rows were returned. Expand dates or refresh ingestion before retrying.</p></td>
                </tr>
              ) : (
                sortedImpacts.map((impact) => (
                  <tr key={impact.id}>
                    <th scope="row">{impact.event.lab.name}</th>
                    <td>{displayTicker(impact.ticker)}</td>
                    <td className={shared.mono}>±{impact.window}d</td>
                    <td className={shared.mono}>{formatPercent(impact.car)}</td>
                    <td className={shared.mono}>{impact.pValue.toFixed(3)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="diag-correlation" className={`${shared.anchorTarget} ${shared.panel} ${shared.revealDelayed}`}>
        <div className={shared.panelHeader}>
          <div>
            <h2 className={shared.title}>Lag-Correlation Matrix</h2>
            <p className={shared.subtitle}>Color and numeric encoding are paired for non-visual and color-blind-safe interpretation.</p>
          </div>
        </div>

        <p className={styles.matrixLegend}>Lag Correlation: relationship between event intensity and returns at lag horizons (0d, 1d, 3d, 7d).</p>

        {correlationsState.error && (
          <div className={shared.alert} role="alert">
            {correlationsState.error}
            <div className={shared.actionRow}>
              <button type="button" className={`${shared.button} ${shared.buttonQuiet}`} onClick={onRetryCorrelations}>Retry Correlation Matrix</button>
            </div>
          </div>
        )}

        <div className={`${shared.tableWrap} ${density === "compact" ? shared.densityCompact : shared.densityCozy}`}>
          <table className={shared.table}>
            <caption className="sr-only">Lag-correlation matrix</caption>
            <thead className={shared.tableHead}>
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
                  <td colSpan={5}><p className={shared.empty}>No correlation rows were returned. Verify events and pricing overlap, then retry.</p></td>
                </tr>
              ) : (
                Array.from(groupedCorrelations.entries()).map(([key, lagMap]) => (
                  <tr key={key}>
                    <th scope="row">{key}</th>
                    {[0, 1, 3, 7].map((lag) => {
                      const value = lagMap.get(lag) ?? 0;
                      return (
                        <td key={lag} className={`${shared.mono} ${correlationCellClass(value)}`}>
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

      <section id="diag-quality" className={`${shared.anchorTarget} ${shared.panel} ${shared.revealDelayed}`}>
        <div className={shared.panelHeader}>
          <div>
            <h2 className={shared.title}>Source Reliability</h2>
            <p className={shared.subtitle}>Local retry controls isolate failures without blocking event-study and correlation diagnostics.</p>
          </div>
          <p className={shared.smallHelp}>Latest run: {statusState.data?.latestRun ? `${statusState.data.latestRun.type} (${statusState.data.latestRun.success ? "success" : "failed"})` : "none"}</p>
        </div>

        {statusState.error && (
          <div className={shared.alert} role="alert">
            {statusState.error}
            <div className={shared.actionRow}>
              <button type="button" className={`${shared.button} ${shared.buttonQuiet}`} onClick={onRetryStatus}>Retry Source Reliability</button>
            </div>
          </div>
        )}

        <div className={styles.qualityKpis}>
          <article className={styles.qualityTile}>
            <p className={styles.qualityLabel}>Healthy Sources</p>
            <p className={styles.qualityValue}>{healthySources}/{sourceRows.length || 0}</p>
            <p className={styles.qualityNote}>Sources with latest successful run</p>
          </article>
          <article className={styles.qualityTile}>
            <p className={styles.qualityLabel}>Failing Sources</p>
            <p className={styles.qualityValue}>{failingSources}</p>
            <p className={styles.qualityNote}>Sources with recent failure marker</p>
          </article>
          <article className={styles.qualityTile}>
            <p className={styles.qualityLabel}>Official Coverage</p>
            <p className={styles.qualityValue}>{officialSources}</p>
            <p className={styles.qualityNote}>Official-tier connectors in current source map</p>
          </article>
        </div>

        <div className={`${shared.tableWrap} ${density === "compact" ? shared.densityCompact : shared.densityCozy}`}>
          <table className={shared.table}>
            <caption className="sr-only">Source reliability by lab</caption>
            <thead className={shared.tableHead}>
              <tr>
                <th scope="col">Lab</th>
                <th scope="col">Source</th>
                <th scope="col">Tier</th>
                <th scope="col">Events</th>
                <th scope="col">Last Success</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.length === 0 ? (
                <tr>
                  <td colSpan={5}><p className={shared.empty}>No source reliability rows yet. Run sync and retry this panel.</p></td>
                </tr>
              ) : (
                sourceRows.map((source) => (
                  <tr key={source.id}>
                    <th scope="row">{source.lab.name}</th>
                    <td>{source.sourceName}</td>
                    <td><span className={`badge ${source.sourceTier === "official" ? "badge-official" : "badge-fallback"}`}>{source.sourceTier}</span></td>
                    <td className={shared.mono}>{source.eventCount}</td>
                    <td className={shared.mono}>{formatDateTime(source.lastSuccessAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="diag-events" className={`${shared.anchorTarget} ${shared.panel} ${shared.revealDelayed}`}>
        <div className={shared.panelHeader}>
          <div>
            <h2 className={shared.title}>Raw Event Feed</h2>
            <p className={shared.subtitle}>Outbound links, confidence metadata, and timestamps for evidence-level inspection.</p>
          </div>
        </div>

        <p className={styles.feedHint}>Use this feed to verify confidence calibration and source provenance before acting on model outputs.</p>

        {eventsState.error && (
          <div className={shared.alert} role="alert">
            {eventsState.error}
            <div className={shared.actionRow}>
              <button type="button" className={`${shared.button} ${shared.buttonQuiet}`} onClick={onRetryEvents}>Retry Event Feed</button>
            </div>
          </div>
        )}

        <div className={`${shared.tableWrap} ${density === "compact" ? shared.densityCompact : shared.densityCozy}`}>
          <table className={shared.table}>
            <caption className="sr-only">Raw event feed</caption>
            <thead className={shared.tableHead}>
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
                  <td colSpan={4}><p className={shared.empty}>No events for this scope. Expand dates or source tier to recover feed coverage.</p></td>
                </tr>
              ) : (
                pageItems.map((event) => (
                  <tr key={event.id}>
                    <th scope="row" className={shared.mono}>{formatDate(event.publishedAt)}</th>
                    <td>{event.lab.name}</td>
                    <td className={shared.mono}>{event.confidence.toFixed(2)}</td>
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

        <div className={shared.pagination}>
          <button type="button" className={shared.pageButton} onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>Previous</button>
          <p className={shared.pageInfo}>Page {currentPage} of {totalPages}</p>
          <button type="button" className={shared.pageButton} onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>Next</button>
        </div>
      </section>
    </>
  );
}
