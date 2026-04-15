import { scenarioMultipliers } from "../config.js";
import { average, clamp, standardDeviation } from "../utils.js";

const classifyRiskLevel = (score) => {
  if (score >= 82) return "critical";
  if (score >= 66) return "high";
  if (score >= 42) return "elevated";
  return "low";
};

const hoursBetween = (from, to) => Math.max(0.01, (to.getTime() - from.getTime()) / 3600000);

export const computeIntelligence = ({ events, simulation, scenario }) => {
  const now = new Date();
  const recent = events.slice(0, 120);
  const factor = scenarioMultipliers[scenario] || 1;

  const macroBars = simulation?.macroIndicators?.bars || [];
  const geoSentiment = average(recent.map((event) => event.sentiment));
  const macroChangeVol = standardDeviation(macroBars.map((bar) => Math.abs(bar.changePct || 0)));
  const commodityBars = macroBars.filter((bar) => bar.category === "commodity");
  const currencyBars = macroBars.filter((bar) => bar.category === "currency" && bar.name !== "USD");

  const commodityPressure = average(commodityBars.map((bar) => Math.abs(bar.changePct || 0)));
  const currencyPressure = average(currencyBars.map((bar) => Math.abs(bar.changePct || 0)));

  const crisisProbability = simulation.monteCarlo.outcomeProbabilities.find((item) => item.name === "Crisis")?.value || 10;
  const tensionProbability = simulation.monteCarlo.outcomeProbabilities.find((item) => item.name === "Tension")?.value || 20;

  const geopoliticalTension = clamp(
    28 + Math.max(0, -geoSentiment) * 42 + (crisisProbability * 0.36 + tensionProbability * 0.18) * factor,
    5,
    100
  );

  const marketStress = clamp(
    22 +
      commodityPressure * 7.5 +
      currencyPressure * 9.2 +
      macroChangeVol * 8.5 +
      Math.max(0, -geoSentiment) * 18 +
      crisisProbability * 0.22 * factor,
    4,
    100
  );

  const last10Min = recent.filter((event) => now.getTime() - new Date(event.timestamp).getTime() <= 10 * 60000);
  const olderWindow = recent.filter((event) => {
    const delta = now.getTime() - new Date(event.timestamp).getTime();
    return delta > 10 * 60000 && delta <= 90 * 60000;
  });

  const oldHours = olderWindow.length
    ? hoursBetween(new Date(olderWindow[olderWindow.length - 1].timestamp), new Date(olderWindow[0].timestamp))
    : 1;

  const recentRate = last10Min.length / (10 / 60);
  const baselineRate = olderWindow.length / oldHours;
  const spikeRatio = baselineRate > 0 ? recentRate / baselineRate : last10Min.length ? 2.2 : 1;

  const sentimentShift = Math.abs(average(last10Min.map((event) => event.sentiment)) - average(olderWindow.map((event) => event.sentiment)));

  const anomalyScore = clamp(10 + spikeRatio * 22 + sentimentShift * 45, 0, 100);

  const riskScore = clamp(geopoliticalTension * 0.47 + marketStress * 0.4 + anomalyScore * 0.13, 0, 100);

  return {
    geopolitical_tension_index: Number(geopoliticalTension.toFixed(2)),
    market_stress_index: Number(marketStress.toFixed(2)),
    anomaly_score: Number(anomalyScore.toFixed(2)),
    risk_score: Number(riskScore.toFixed(2)),
    risk_level: classifyRiskLevel(riskScore),
    details: {
      crisis_probability: crisisProbability,
      tension_probability: tensionProbability,
      commodity_pressure: Number(commodityPressure.toFixed(3)),
      currency_pressure: Number(currencyPressure.toFixed(3)),
      event_spike_ratio: Number(spikeRatio.toFixed(3)),
      sentiment_shift: Number(sentimentShift.toFixed(3)),
      scenario
    }
  };
};
