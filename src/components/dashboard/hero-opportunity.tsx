import type { CSSProperties } from "react";
import clsx from "clsx";
import signalStyles from "@/components/dashboard/signals-view.module.css";
import type { ForwardSignal } from "@/components/dashboard/types";
import { confidenceBadgeClass } from "@/components/dashboard/utils";

type OpportunityDelta = {
  edgeDeltaPct: number;
  confidenceDelta: number;
};

type HeroOpportunityProps = {
  signal: ForwardSignal | undefined;
  delta: OpportunityDelta | undefined;
  displayTicker: (ticker: string) => string;
  asOf: string | undefined;
};

function signedValue(value: number, digits: number): string {
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
}

export function HeroOpportunity({ signal, delta, displayTicker, asOf }: HeroOpportunityProps) {
  const confidenceClass = signal
    ? signal.confidenceBand === "high"
      ? signalStyles.confidenceHigh
      : signal.confidenceBand === "medium"
        ? signalStyles.confidenceMedium
        : signalStyles.confidenceLow
    : signalStyles.confidenceLow;

  return (
    <article className={signalStyles.heroCard}>
      <div className={signalStyles.heroTopline}>
        <div className={signalStyles.heroHeader}>
          <div>
            <p className={signalStyles.heroKicker}>Top call</p>
            <h2 className={signalStyles.heroTitle}>
              {signal ? `${signal.labName} vs ${displayTicker(signal.ticker)}` : "No ranked opportunity"}
            </h2>
            <p className={signalStyles.heroEdge}>
              {signal
                ? `Expected edge ${signal.avgCarPct.toFixed(2)}% · As of ${asOf?.slice(0, 10) ?? "-"}`
                : "Apply broader filters or lower minimum confidence to surface opportunities."}
            </p>
          </div>

          {signal && (
            <div className={signalStyles.heroBadges}>
              <span className={clsx("badge", confidenceBadgeClass(signal.confidenceBand))}>
                {(signal.confidenceScore * 100).toFixed(0)} confidence
              </span>
              <span
                className={clsx(
                  signalStyles.directionBadge,
                  signal.direction === "long-bias" ? signalStyles.directionLong : signalStyles.directionShort,
                )}
              >
                {signal.direction === "long-bias" ? "Long bias" : "Short bias"}
              </span>
            </div>
          )}
        </div>

        {signal ? (
          <>
            <p className={signalStyles.heroRationale}>{signal.thesis}</p>

            <div className={signalStyles.confidenceWrap}>
              <div className={signalStyles.confidenceMeta}>
                <p className={signalStyles.confidenceLabel}>Confidence runway</p>
                <span className={signalStyles.confidenceValue}>{signal.nSamples} samples</span>
              </div>

              <div className={signalStyles.confidenceTrack} aria-hidden="true">
                <span
                  className={clsx(signalStyles.confidenceFill, confidenceClass)}
                  style={{ width: `${(signal.confidenceScore * 100).toFixed(0)}%` } as CSSProperties}
                />
              </div>
            </div>

            <div className={signalStyles.heroStats}>
              <div className={signalStyles.heroStat}>
                <p className={signalStyles.heroStatLabel}>Signal rate</p>
                <p className={signalStyles.heroStatValue}>{signal.sigRatePct.toFixed(1)}%</p>
              </div>
              <div className={signalStyles.heroStat}>
                <p className={signalStyles.heroStatLabel}>Best lag correlation</p>
                <p className={signalStyles.heroStatValue}>{signal.bestLagDays}d ({signal.bestLagCorrelation.toFixed(2)})</p>
              </div>
              <div className={signalStyles.heroStat}>
                <p className={signalStyles.heroStatLabel}>Sample base</p>
                <p className={signalStyles.heroStatValue}>{signal.nSamples} event windows</p>
              </div>
            </div>

            {delta && (
              <div className={signalStyles.deltaRow}>
                <span className={clsx(signalStyles.deltaChip, delta.edgeDeltaPct >= 0 ? signalStyles.deltaPositive : signalStyles.deltaNegative)}>
                  Edge delta {signedValue(delta.edgeDeltaPct, 2)}%
                </span>
                <span className={clsx(signalStyles.deltaChip, delta.confidenceDelta >= 0 ? signalStyles.deltaPositive : signalStyles.deltaNegative)}>
                  Confidence delta {signedValue(delta.confidenceDelta * 100, 1)}
                </span>
              </div>
            )}
          </>
        ) : (
          <p className={signalStyles.heroEmpty}>
            No opportunities passed the current filters. Try expanding date range, lowering minimum confidence, or including additional labs.
          </p>
        )}
      </div>
    </article>
  );
}
