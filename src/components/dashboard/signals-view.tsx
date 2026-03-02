"use client";

import styles from "@/components/dashboard/dashboard.module.css";
import type { DashboardSort, DensityMode, ForwardSignalsResponse, LoadState } from "@/components/dashboard/types";
import { confidenceBadgeClass, paginate, priorityBadgeClass, sortForwardSignals } from "@/components/dashboard/utils";

type SignalsViewProps = {
  sort: DashboardSort;
  density: DensityMode;
  page: number;
  onPageChange: (page: number) => void;
  displayTicker: (ticker: string) => string;
  forwardState: LoadState<ForwardSignalsResponse>;
  onRetryForward: () => void;
};

export function SignalsView({ sort, density, page, onPageChange, displayTicker, forwardState, onRetryForward }: SignalsViewProps) {
  const forward = forwardState.data;
  const signals = sortForwardSignals(forward?.topSignals ?? [], sort);
  const pageSize = density === "compact" ? 14 : 10;
  const { pageItems, currentPage, totalPages } = paginate(signals, page, pageSize);

  return (
    <>
      <nav className={styles.sectionNav} aria-label="Signals sections">
        <a className={styles.sectionLink} href="#signals-ranked">Ranked Signals</a>
        <a className={styles.sectionLink} href="#signals-pairs">Pair Ideas</a>
        <a className={styles.sectionLink} href="#signals-insights">Insights and Actions</a>
      </nav>

      <section id="signals-ranked" className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.title}>Forward Signals</h2>
            <p className={styles.subtitle}>CAR means cumulative abnormal return. Sig Rate captures how often post-release reactions were statistically significant.</p>
          </div>
          <p className={styles.smallHelp}>Model horizon: {forward?.signalWindowDays ?? 7} days</p>
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
            <caption className="sr-only">Forward signals table</caption>
            <thead className={styles.tableHead}>
              <tr>
                <th scope="col">Lab</th>
                <th scope="col">Ticker</th>
                <th scope="col">Bias</th>
                <th scope="col">Avg CAR</th>
                <th scope="col">Sig Rate</th>
                <th scope="col">Best Lag</th>
                <th scope="col">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7}><p className={styles.empty}>No signal rows match this filter set. Lower confidence threshold or expand dates.</p></td>
                </tr>
              ) : (
                pageItems.map((signal) => (
                  <tr key={`${signal.labId}-${signal.ticker}`}>
                    <th scope="row">{signal.labName}</th>
                    <td>{displayTicker(signal.ticker)}</td>
                    <td className={signal.direction === "long-bias" ? "tone-positive" : "tone-negative"}>{signal.direction === "long-bias" ? "Long" : "Short"}</td>
                    <td className={styles.mono}>{signal.avgCarPct.toFixed(2)}%</td>
                    <td className={styles.mono}>{signal.sigRatePct.toFixed(1)}%</td>
                    <td className={styles.mono}>{signal.bestLagDays}d ({signal.bestLagCorrelation.toFixed(2)})</td>
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

      <section id="signals-pairs" className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.title}>Pair Ideas</h2>
            <p className={styles.subtitle}>Relative-value candidates from strongest positive and negative post-release reactions.</p>
          </div>
        </div>

        <div className={styles.grid2}>
          {(forward?.pairIdeas ?? []).length === 0 ? (
            <p className={styles.empty}>No pair ideas met current thresholds. Lower confidence or widen the date range.</p>
          ) : (
            (forward?.pairIdeas ?? []).map((idea) => (
              <article key={`${idea.labId}-${idea.longTicker}-${idea.shortTicker}`} className={styles.metricCard}>
                <p className={styles.metricLabel}>{idea.labName}</p>
                <p className={styles.metricValue}>Long {displayTicker(idea.longTicker)} / Short {displayTicker(idea.shortTicker)}</p>
                <p className={styles.metricNote}>{idea.thesis}</p>
                <p className={`${styles.metricNote} ${styles.mono}`}>Expected spread: {idea.expectedSpreadPct.toFixed(2)}%</p>
                <span className={`badge ${confidenceBadgeClass(idea.confidenceBand)}`}>{(idea.confidenceScore * 100).toFixed(0)}</span>
              </article>
            ))
          )}
        </div>
      </section>

      <section id="signals-insights" className={styles.grid2}>
        <article className={styles.panel}>
          <h2 className={styles.title}>Trending Insights</h2>
          <p className={styles.subtitle}>Generated from current regime and strongest lab/ticker relationships.</p>
          <div className={styles.grid2}>
            {(forward?.trendingInsights ?? []).length === 0 ? (
              <p className={styles.empty}>No insights available for these filters.</p>
            ) : (
              (forward?.trendingInsights ?? []).map((insight) => (
                <article className={styles.metricCard} key={insight.id}>
                  <p className={styles.metricLabel}>{insight.importance}</p>
                  <p className={styles.metricValue}>{insight.headline}</p>
                  <p className={styles.metricNote}>{insight.detail}</p>
                </article>
              ))
            )}
          </div>
        </article>

        <article className={styles.panel}>
          <h2 className={styles.title}>Next Best Actions</h2>
          <p className={styles.subtitle}>Action-oriented suggestions based on confidence and signal regime.</p>
          <div className={styles.grid2}>
            {(forward?.nextBestActions ?? []).length === 0 ? (
              <p className={styles.empty}>No actions generated for these filters.</p>
            ) : (
              (forward?.nextBestActions ?? []).map((action) => (
                <article className={styles.metricCard} key={action.id}>
                  <p className={styles.metricLabel}>Horizon: {action.horizon}</p>
                  <p className={styles.metricValue}>{action.action}</p>
                  <p className={styles.metricNote}>{action.rationale}</p>
                  <span className={`badge ${priorityBadgeClass(action.priority)}`}>{action.priority}</span>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </>
  );
}
