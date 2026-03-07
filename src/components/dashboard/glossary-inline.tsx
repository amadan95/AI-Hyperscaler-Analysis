import signalStyles from "@/components/dashboard/signals-view.module.css";

const TERMS = [
  {
    name: "CAR",
    text: "Cumulative abnormal return versus benchmark expectation across the selected post-event window.",
  },
  {
    name: "Sig Rate",
    text: "Share of historical event windows that produced statistically significant post-release moves.",
  },
  {
    name: "Lag Correlation",
    text: "Correlation between event intensity and ticker returns at delayed horizons (0d, 1d, 3d, 7d).",
  },
  {
    name: "Confidence Score",
    text: "Model confidence combining sample size, stability, significance, and source reliability signals.",
  },
];

export function GlossaryInline() {
  return (
    <section className={signalStyles.glossaryCard} id="signals-glossary" aria-label="Glossary">
      <h2 className={signalStyles.glossaryTitle}>Desk footnotes</h2>
      <p className={signalStyles.glossaryLead}>Quick definitions for the shorthand used throughout the signal brief and evidence tables.</p>
      <ol className={signalStyles.glossaryList}>
        {TERMS.map((term, index) => (
          <li className={signalStyles.glossaryItem} key={term.name}>
            <span className={signalStyles.glossaryIndex}>{String(index + 1).padStart(2, "0")}</span>
            <div className={signalStyles.glossaryBody}>
              <p className={signalStyles.glossaryName}>{term.name}</p>
              <p className={signalStyles.glossaryText}>{term.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
