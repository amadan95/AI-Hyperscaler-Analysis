import { describe, expect, it } from "vitest";
import { computeWindowMetrics, empiricalPValue } from "@/lib/analysis/eventStudy";
import type { PriceSeriesRow } from "@/types/domain";

function buildRow(index: number, abnormalReturn: number): PriceSeriesRow {
  return {
    ticker: "MSFT",
    date: new Date(`2024-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
    close: 100 + index,
    dailyReturn: 0.01,
    benchmarkReturn: 0.005,
    abnormalReturn,
  };
}

describe("event study math", () => {
  it("computes window-level CAR and valid p-value", () => {
    const rows = [
      buildRow(0, 0.001),
      buildRow(1, 0.002),
      buildRow(2, 0.04),
      buildRow(3, 0.001),
      buildRow(4, -0.002),
      buildRow(5, 0.001),
      buildRow(6, 0.002),
      buildRow(7, 0.001),
      buildRow(8, 0.0),
      buildRow(9, -0.001),
      buildRow(10, 0.001),
    ];

    const metrics = computeWindowMetrics(rows, 2, 1);
    expect(metrics.car).toBeCloseTo(0.043, 5);

    const pValue = empiricalPValue(rows, 1, metrics.car, new Set([2]));
    expect(pValue).toBeGreaterThan(0);
    expect(pValue).toBeLessThanOrEqual(1);
  });
});
