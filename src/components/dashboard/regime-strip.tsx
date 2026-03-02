import clsx from "clsx";
import signalStyles from "@/components/dashboard/signals-view.module.css";
import type { ForwardSignalsResponse, StatusResponse } from "@/components/dashboard/types";
import { classifyRegime } from "@/components/dashboard/utils";

type RegimeStripProps = {
  forward: ForwardSignalsResponse | undefined;
  status: StatusResponse | undefined;
};

function toneClass(tone: "high" | "medium" | "low"): string {
  if (tone === "high") return signalStyles.regimeHigh;
  if (tone === "medium") return signalStyles.regimeMedium;
  return signalStyles.regimeLow;
}

export function RegimeStrip({ forward, status }: RegimeStripProps) {
  const regime = classifyRegime(forward);
  const actionableCount = (forward?.topSignals ?? []).filter((signal) => signal.actionable).length;
  const sourceCount = status?.sources.length ?? 0;
  const healthySources = (status?.sources ?? []).filter((source) => source.lastSuccessAt).length;
  const burstRatio = forward?.regime?.burstRatio ?? 0;

  return (
    <section className={signalStyles.stripGrid} aria-label="Regime snapshot">
      <article className={signalStyles.stripCard}>
        <p className={signalStyles.stripTitle}>Regime Snapshot</p>
        <p className={signalStyles.stripValue}>{regime.label}</p>
        <span className={clsx(signalStyles.regimeBadge, toneClass(regime.tone))}>{regime.tone}</span>
        <p className={signalStyles.stripNote}>{regime.note}</p>
      </article>

      <article className={signalStyles.stripCard}>
        <p className={signalStyles.stripTitle}>Actionable Count</p>
        <p className={signalStyles.stripValue}>{actionableCount}</p>
        <p className={signalStyles.stripNote}>{(forward?.topSignals.length ?? 0)} ranked opportunities in view</p>
      </article>

      <article className={signalStyles.stripCard}>
        <p className={signalStyles.stripTitle}>Source-Health Pulse</p>
        <p className={signalStyles.stripValue}>{healthySources}/{sourceCount || 0}</p>
        <p className={signalStyles.stripNote}>Burst ratio {(burstRatio * 100).toFixed(0)}% over active event days</p>
      </article>
    </section>
  );
}
