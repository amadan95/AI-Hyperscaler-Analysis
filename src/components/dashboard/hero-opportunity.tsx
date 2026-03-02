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
  return (
    <article className={signalStyles.heroCard}>
      <div className={signalStyles.heroHeader}>
        <div>
          <p className={signalStyles.heroKicker}>Top Opportunity</p>
          <h2 className={signalStyles.heroTitle}>
            {signal ? `${signal.labName} vs ${displayTicker(signal.ticker)}` : "No ranked opportunity"}
          </h2>
          <p className={signalStyles.heroEdge}>
            {signal
              ? `Expected edge (Avg CAR): ${signal.avgCarPct.toFixed(2)}% · As of ${asOf?.slice(0, 10) ?? "-"}`
              : "Apply broader filters or lower minimum confidence to surface opportunities."}
          </p>
        </div>
        {signal && (
          <span className={`badge ${confidenceBadgeClass(signal.confidenceBand)}`}>
            {(signal.confidenceScore * 100).toFixed(0)} confidence
          </span>
        )}
      </div>

      {signal ? (
        <>
          <p className={signalStyles.heroRationale}>{signal.thesis}</p>
          <div className={signalStyles.heroStats}>
            <div className={signalStyles.heroStat}>
              <p className={signalStyles.heroStatLabel}>Signal Rate</p>
              <p className={signalStyles.heroStatValue}>{signal.sigRatePct.toFixed(1)}%</p>
            </div>
            <div className={signalStyles.heroStat}>
              <p className={signalStyles.heroStatLabel}>Best Lag Correlation</p>
              <p className={signalStyles.heroStatValue}>{signal.bestLagDays}d ({signal.bestLagCorrelation.toFixed(2)})</p>
            </div>
            <div className={signalStyles.heroStat}>
              <p className={signalStyles.heroStatLabel}>Bias</p>
              <p className={signalStyles.heroStatValue}>{signal.direction === "long-bias" ? "Long" : "Short"}</p>
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
    </article>
  );
}
