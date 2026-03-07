"use client";

import type { CSSProperties } from "react";
import shared from "@/components/dashboard/dashboard.module.css";
import styles from "@/components/dashboard/signals-view.module.css";
import { GlossaryInline } from "@/components/dashboard/glossary-inline";
import { HeroOpportunity } from "@/components/dashboard/hero-opportunity";
import { RegimeStrip } from "@/components/dashboard/regime-strip";
import type {
  DashboardSort,
  DensityMode,
  ForwardSignalsResponse,
  LoadState,
  PanelKey,
  StatusResponse,
} from "@/components/dashboard/types";
import {
  confidenceBadgeClass,
  paginate,
  priorityBadgeClass,
  sortForwardSignals,
  topOpportunity,
} from "@/components/dashboard/utils";

type OpportunityDelta = {
  edgeDeltaPct: number;
  confidenceDelta: number;
};

type SignalsViewProps = {
  sort: DashboardSort;
  density: DensityMode;
  page: number;
  onPageChange: (page: number) => void;
  displayTicker: (ticker: string) => string;
  forwardState: LoadState<ForwardSignalsResponse>;
  statusState: LoadState<StatusResponse>;
  opportunityDelta: OpportunityDelta | undefined;
  onRetryForward: () => void;
  onRetryStatus: () => void;
  onSetPanel: (panel: PanelKey) => void;
};

export function SignalsView({
  sort,
  density,
  page,
  onPageChange,
  displayTicker,
  forwardState,
  statusState,
  opportunityDelta,
  onRetryForward,
  onRetryStatus,
  onSetPanel,
}: SignalsViewProps) {
  const forward = forwardState.data;
  const signals = sortForwardSignals(forward?.topSignals ?? [], sort);
  const pageSize = density === "compact" ? 14 : 10;
  const { pageItems, currentPage, totalPages } = paginate(signals, page, pageSize);
  const leadSignal = topOpportunity(forward?.topSignals ?? []);

  function confidenceClass(confidenceBand: "high" | "medium" | "low"): string {
    if (confidenceBand === "high") return styles.confidenceHigh;
    if (confidenceBand === "medium") return styles.confidenceMedium;
    return styles.confidenceLow;
  }

  return (
    <>
      <nav className={shared.sectionNav} aria-label="Signals sections">
        <a className={shared.sectionLink} href="#signals-hero" onClick={() => onSetPanel("hero")}>Top Opportunity</a>
        <a className={shared.sectionLink} href="#signals-ranked" onClick={() => onSetPanel("ranked")}>Ranked Opportunities</a>
        <a className={shared.sectionLink} href="#signals-glossary" onClick={() => onSetPanel("quality")}>Glossary</a>
      </nav>

      <section id="signals-hero" className={`${shared.anchorTarget} ${styles.heroGrid} ${shared.reveal}`}>
        <HeroOpportunity signal={leadSignal} delta={opportunityDelta} displayTicker={displayTicker} asOf={forward?.asOf} />

        <aside className={styles.sideCard}>
          <h2 className={styles.sideTitle}>Lead action</h2>
          {(forward?.nextBestActions ?? []).length === 0 ? (
            <p className={styles.sideHelp}>No next actions available. Lower confidence threshold or widen date range to regenerate guidance.</p>
          ) : (
            <>
              <p className={styles.sideHeadline}>{forward?.nextBestActions[0]?.action}</p>
              <p className={styles.sideMeta}>{forward?.nextBestActions[0]?.rationale}</p>
              <p className={styles.sideMeta}>Horizon: {forward?.nextBestActions[0]?.horizon}</p>
            </>
          )}
        </aside>
      </section>

      <RegimeStrip forward={forward} status={statusState.data} />

      <section id="signals-ranked" className={`${shared.anchorTarget} ${styles.bodyGrid} ${shared.revealDelayed}`}>
        <article className={shared.panel}>
          <div className={shared.panelHeader}>
            <div>
              <h2 className={shared.title}>Ranked Opportunities</h2>
              <p className={shared.subtitle}>Top ranked trade expressions ordered by signal quality, event-study edge, and lag behavior.</p>
              <p className={styles.tableLead}>CAR = cumulative abnormal return. Sig Rate = share of significant post-release outcomes.</p>
            </div>
            <p className={shared.smallHelp}>Model horizon: {forward?.signalWindowDays ?? 7} days</p>
          </div>

          {forwardState.error && (
            <div className={shared.alert} role="alert">
              {forwardState.error}
              <div className={shared.actionRow}>
                <button type="button" className={`${shared.button} ${shared.buttonQuiet}`} onClick={onRetryForward}>Retry Opportunities</button>
              </div>
            </div>
          )}

          <div className={`${shared.tableWrap} ${density === "compact" ? shared.densityCompact : shared.densityCozy}`}>
            <table className={shared.table}>
              <caption className="sr-only">Ranked opportunities table</caption>
              <thead className={shared.tableHead}>
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
                    <td colSpan={7}><p className={shared.empty}>No ranked opportunities for these filters. Lower confidence, expand dates, or include more labs.</p></td>
                  </tr>
                ) : (
                  pageItems.map((signal) => (
                    <tr key={`${signal.labId}-${signal.ticker}`}>
                      <th scope="row">{signal.labName}</th>
                      <td>{displayTicker(signal.ticker)}</td>
                      <td className={`${styles.tableTone} ${signal.direction === "long-bias" ? "tone-positive" : "tone-negative"}`}>
                        {signal.direction === "long-bias" ? "Long bias" : "Short bias"}
                      </td>
                      <td className={shared.mono}>{signal.avgCarPct.toFixed(2)}%</td>
                      <td className={shared.mono}>{signal.sigRatePct.toFixed(1)}%</td>
                      <td className={shared.mono}>{signal.bestLagDays}d ({signal.bestLagCorrelation.toFixed(2)})</td>
                      <td>
                        <div className={styles.confidenceCell}>
                          <div className={styles.confidenceTrackSmall} aria-hidden="true">
                            <span
                              className={`${styles.confidenceFillSmall} ${confidenceClass(signal.confidenceBand)}`}
                              style={{ width: `${(signal.confidenceScore * 100).toFixed(0)}%` } as CSSProperties}
                            />
                          </div>
                          <span className={shared.mono}>{(signal.confidenceScore * 100).toFixed(0)}</span>
                        </div>
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
        </article>

        <aside className={styles.sideRail}>
          <article className={styles.sideCard}>
            <h2 className={styles.sideTitle}>Action queue</h2>
            <p className={styles.sideHelp}>Execution notes ordered by urgency and confidence.</p>
            <ul className={styles.sideList}>
              {(forward?.nextBestActions ?? []).length === 0 ? (
                <li className={styles.sideItem}>
                  <p className={styles.sideMeta}>No actions generated. Adjust filters and refresh to recover action guidance.</p>
                </li>
              ) : (
                (forward?.nextBestActions ?? []).slice(0, 5).map((action) => (
                  <li className={styles.sideItem} key={action.id}>
                    <p className={styles.sideLabel}>Horizon {action.horizon}</p>
                    <p className={styles.sideHeadline}>{action.action}</p>
                    <p className={styles.sideMeta}>{action.rationale}</p>
                    <span className={`badge ${priorityBadgeClass(action.priority)}`}>{action.priority}</span>
                  </li>
                ))
              )}
            </ul>
          </article>

          <article className={styles.sideCard}>
            <h2 className={styles.sideTitle}>Pair trades</h2>
            <p className={styles.sideHelp}>Relative-value structures synthesized from the strongest positive and negative reactions.</p>
            <ul className={styles.sideList}>
              {(forward?.pairIdeas ?? []).length === 0 ? (
                <li className={styles.sideItem}>
                  <p className={styles.sideMeta}>No pair setups met the current threshold. Lower confidence or expand filters.</p>
                </li>
              ) : (
                (forward?.pairIdeas ?? []).slice(0, 5).map((idea) => (
                  <li className={styles.sideItem} key={`${idea.labId}-${idea.longTicker}-${idea.shortTicker}`}>
                    <p className={styles.sideLabel}>{idea.labName}</p>
                    <p className={styles.sideHeadline}>Long {displayTicker(idea.longTicker)} / Short {displayTicker(idea.shortTicker)}</p>
                    <p className={styles.sideMeta}>{idea.thesis}</p>
                    <p className={styles.sideMeta}>Expected spread {idea.expectedSpreadPct.toFixed(2)}%</p>
                    <span className={`badge ${confidenceBadgeClass(idea.confidenceBand)}`}>{(idea.confidenceScore * 100).toFixed(0)}</span>
                  </li>
                ))
              )}
            </ul>
          </article>

          {statusState.error && (
            <article className={styles.sideCard}>
              <h2 className={styles.sideTitle}>Source Reliability Recovery</h2>
              <p className={styles.sideHelp}>{statusState.error}</p>
              <button type="button" className={`${shared.button} ${shared.buttonQuiet}`} onClick={onRetryStatus}>Retry Source Reliability</button>
            </article>
          )}
        </aside>
      </section>

      <GlossaryInline />
    </>
  );
}
