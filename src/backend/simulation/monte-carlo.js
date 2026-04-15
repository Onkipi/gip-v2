import { scenarioMultipliers } from "../config.js";
import { average, clamp, randomBetween, standardDeviation, weightedChoice } from "../utils.js";

const normalizeProbabilities = (input) => {
  const total = input.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return input.map((item, index) => ({ ...item, value: index === 0 ? 100 : 0 }));
  }
  return input.map((item) => ({ ...item, value: Number(((item.value / total) * 100).toFixed(2)) }));
};

export const runRollingMonteCarlo = ({ events, previousSimulation, iterations, scenario }) => {
  const recent = events.slice(0, 120);
  const sentiments = recent.map((event) => event.sentiment);
  const impacts = recent.map((event) => event.impact_score);
  const volatilities = recent.map((event) => event.volatility || 0.1);

  const avgSentiment = average(sentiments);
  const impactVolatility = standardDeviation(impacts);
  const avgVolatility = average(volatilities);

  const firstTs = recent[recent.length - 1]?.timestamp;
  const latestTs = recent[0]?.timestamp;
  const lookbackHours = firstTs && latestTs
    ? Math.max(1, (new Date(latestTs).getTime() - new Date(firstTs).getTime()) / 3600000)
    : 1;

  const eventFrequency = recent.length / lookbackHours;
  const scenarioFactor = scenarioMultipliers[scenario] || 1;

  const prevCrisis = previousSimulation?.outcomeProbabilities?.find((item) => item.name === "Crisis")?.value || 10;
  const baseRate = 0.08 + (prevCrisis / 100) * 0.22;
  const sentimentWeight = 1 + Math.max(0, -avgSentiment) * 0.95;
  const volatilityFactor = 1 + impactVolatility / 70 + avgVolatility / 2.8 + eventFrequency / 32;

  const crisisProbability = clamp(baseRate * sentimentWeight * volatilityFactor * scenarioFactor, 0.03, 0.92);
  const tensionProbability = clamp(0.15 + Math.max(0, -avgSentiment) * 0.23 + eventFrequency / 45, 0.06, 0.78);
  const stabilityProbability = clamp(1 - crisisProbability - tensionProbability, 0.03, 0.9);

  const normalized = normalizeProbabilities([
    { name: "Stability", value: stabilityProbability },
    { name: "Tension", value: tensionProbability },
    { name: "Crisis", value: crisisProbability }
  ]);

  const counters = {
    Stability: 0,
    Tension: 0,
    Crisis: 0
  };

  for (let i = 0; i < iterations; i += 1) {
    const result = weightedChoice(
      normalized.map((item) => ({
        value: item.name,
        weight: item.value
      }))
    );
    counters[result] += 1;
  }

  const outcomes = normalizeProbabilities([
    { name: "Stability", value: counters.Stability },
    { name: "Tension", value: counters.Tension },
    { name: "Crisis", value: counters.Crisis }
  ]);

  const points = Array.from({ length: 28 }).map((_, index) => {
    const drift = (index / 27) * (scenarioFactor - 1) * 14;
    const stability = clamp(outcomes[0].value - drift + randomBetween(-2.4, 2.4), 2, 96);
    const tension = clamp(outcomes[1].value + drift * 0.5 + randomBetween(-1.9, 1.9), 1, 92);
    const crisis = clamp(100 - stability - tension + randomBetween(-1.4, 1.4), 1, 95);

    return {
      step: index,
      stability: Number(stability.toFixed(2)),
      tension: Number(tension.toFixed(2)),
      crisis: Number(clamp(crisis, 1, 98).toFixed(2))
    };
  });

  return {
    timestamp: new Date().toISOString(),
    scenario,
    iterations,
    outcomeProbabilities: outcomes,
    timeseries: points,
    inputs: {
      base_rate: Number(baseRate.toFixed(4)),
      sentiment_weight: Number(sentimentWeight.toFixed(4)),
      volatility_factor: Number(volatilityFactor.toFixed(4)),
      event_frequency: Number(eventFrequency.toFixed(4)),
      formula: "probability = base_rate * sentiment_weight * volatility_factor * scenario_multiplier"
    }
  };
};
