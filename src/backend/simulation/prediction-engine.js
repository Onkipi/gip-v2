import { config, scenarioMultipliers } from "../config.js";
import { average, clamp, randomBetween } from "../utils.js";

const ESCALATION_KEYWORDS = [
  "retaliation",
  "strike",
  "missile",
  "drone",
  "mobilization",
  "airstrike",
  "incursion",
  "carrier",
  "sanction",
  "blockade",
  "warning"
];

const PREDICTION_KEYWORDS = {
  iran_strike_7d: ["iran", "tehran", "proxy", "missile", "drone", "retaliation", "strike"],
  us_escalation_7d: ["united states", "u.s.", "us", "pentagon", "carrier", "deploy", "response"],
  shipping_disruption_7d: ["strait", "hormuz", "tanker", "shipping", "oil", "naval", "chokepoint"]
};

const LAYER_WEIGHTS = {
  core_news: 0.9,
  news_api: 0.88,
  osint_war: 0.82,
  osint_aggregate: 0.78,
  radar_air: 0.86,
  radar_naval: 0.86,
  social_x: 0.62,
  social_reddit: 0.55,
  osint_video: 0.64,
  satellite: 0.74,
  fallback: 0.2
};

const PATTERN_LIBRARY = [
  {
    name: "Rapid Air Campaign Signature",
    description: "High airborne surveillance/refueling and escalatory rhetoric in a compressed window.",
    vector: {
      airOps: 0.92,
      proxyOps: 0.58,
      navalPressure: 0.42,
      commodityShock: 0.46,
      socialEscalation: 0.74,
      negativeSentiment: 0.83
    }
  },
  {
    name: "Proxy Retaliation Cycle",
    description: "Distributed attacks with social escalation and persistent chain propagation.",
    vector: {
      airOps: 0.44,
      proxyOps: 0.91,
      navalPressure: 0.32,
      commodityShock: 0.39,
      socialEscalation: 0.78,
      negativeSentiment: 0.72
    }
  },
  {
    name: "Energy Chokepoint Pressure",
    description: "Naval pressure and commodities stress rising with regional tension.",
    vector: {
      airOps: 0.34,
      proxyOps: 0.42,
      navalPressure: 0.92,
      commodityShock: 0.89,
      socialEscalation: 0.52,
      negativeSentiment: 0.66
    }
  },
  {
    name: "Diplomatic Cooling / Containment",
    description: "Lower escalatory language, reduced chain velocity, and moderated market stress.",
    vector: {
      airOps: 0.2,
      proxyOps: 0.28,
      navalPressure: 0.24,
      commodityShock: 0.25,
      socialEscalation: 0.31,
      negativeSentiment: 0.29
    }
  }
];

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

const percentile = (sorted, q) => {
  if (!sorted.length) return 0;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q)));
  return sorted[index];
};

const toEventText = (event) => `${event.headline || ""} ${event.summary || ""}`.toLowerCase();

const hasEscalationKeyword = (event) => {
  const text = toEventText(event);
  return ESCALATION_KEYWORDS.some((keyword) => text.includes(keyword));
};

const linearTrendSlope = (values = []) => {
  if (values.length <= 1) return 0;
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = average(values);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = i - meanX;
    numerator += dx * (values[i] - meanY);
    denominator += dx * dx;
  }
  return denominator > 0 ? numerator / denominator : 0;
};

const smoothSeries = (values = [], alpha = 0.35) => {
  if (!values.length) return [];
  const result = [values[0]];
  for (let i = 1; i < values.length; i += 1) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
};

const normalizePct = (value) => Number(clamp(value, 0, 100).toFixed(2));

const simulateProbabilityBand = ({ base, variance, runs = config.predictionMonteCarloRuns }) => {
  const samples = [];
  let hits = 0;

  for (let i = 0; i < runs; i += 1) {
    const sampled = clamp(base + randomBetween(-variance, variance), 0.01, 0.99);
    samples.push(sampled);
    if (Math.random() < sampled) hits += 1;
  }

  samples.sort((a, b) => a - b);

  return {
    probability: normalizePct((hits / runs) * 100),
    p10: normalizePct(percentile(samples, 0.1) * 100),
    p90: normalizePct(percentile(samples, 0.9) * 100)
  };
};

const buildFeatureVector = ({ events, macroBars, risks, scenario }) => {
  const recent = events.slice(0, 220);
  const now = Date.now();

  const last24h = recent.filter((event) => now - new Date(event.timestamp).getTime() <= 24 * 3600000);
  const prior24to72h = recent.filter((event) => {
    const age = now - new Date(event.timestamp).getTime();
    return age > 24 * 3600000 && age <= 72 * 3600000;
  });

  const negSentiment = Math.max(0, -average(recent.map((event) => event.sentiment)));
  const highImpactRatio = recent.length ? recent.filter((event) => event.impact_score >= 70).length / recent.length : 0;
  const escalationKeywordRatio = recent.length ? recent.filter(hasEscalationKeyword).length / recent.length : 0;

  const layerCount = (layer) => recent.filter((event) => event.metadata?.layer === layer).length;
  const airOps = layerCount("radar_air");
  const navalOps = layerCount("radar_naval");
  const proxyOps = layerCount("osint_war") + layerCount("osint_video");
  const socialOps = layerCount("social_x") + layerCount("social_reddit");

  const regionCounts = new Map();
  for (const event of recent) {
    const key = event.region || "Global";
    regionCounts.set(key, (regionCounts.get(key) || 0) + 1);
  }
  const topRegionEntry = [...regionCounts.entries()].sort((a, b) => b[1] - a[1])[0] || ["Global", 0];

  const rate24 = last24h.length / 24;
  const rateBaseline = prior24to72h.length / 48 || 0.001;
  const eventSpikeRatio = rate24 / rateBaseline;

  const crisisProb = (risks?.details?.crisis_probability || 0) / 100;
  const tensionProb = (risks?.details?.tension_probability || 0) / 100;

  const oil = macroBars.find((bar) => bar.name === "Crude Oil");
  const wheat = macroBars.find((bar) => bar.name === "Food (Wheat)");
  const commodityShock = clamp((Math.abs(oil?.changePct || 0) + Math.abs(wheat?.changePct || 0)) / 7, 0, 1);

  const scenarioPressure = clamp((scenarioMultipliers[scenario] || 1) - 1, 0, 1);

  return {
    negSentiment,
    highImpactRatio,
    escalationKeywordRatio,
    airOps,
    navalOps,
    proxyOps,
    socialOps,
    eventSpikeRatio: clamp(eventSpikeRatio, 0, 6),
    crisisProb,
    tensionProb,
    commodityShock,
    scenarioPressure,
    clusterRegion: topRegionEntry[0],
    clusterRatio: recent.length ? topRegionEntry[1] / recent.length : 0
  };
};

const buildProbabilisticProjection = ({ features, scenario }) => {
  const stressTerm = 1 + features.scenarioPressure * 0.65;

  const pIranStrike = sigmoid(
    -1.78 +
      2.6 * features.negSentiment +
      2.0 * features.highImpactRatio +
      1.35 * features.escalationKeywordRatio +
      0.24 * Math.log1p(features.airOps + features.proxyOps) +
      0.9 * features.crisisProb +
      0.4 * features.scenarioPressure
  );

  const pUsEscalation = sigmoid(
    -1.94 +
      2.15 * features.negSentiment +
      1.35 * features.highImpactRatio +
      0.36 * Math.log1p(features.airOps) +
      0.22 * Math.log1p(features.navalOps) +
      0.78 * features.tensionProb +
      0.31 * features.scenarioPressure
  );

  const pShippingDisruption = sigmoid(
    -2.1 +
      2.2 * features.commodityShock +
      0.54 * Math.log1p(features.navalOps) +
      0.33 * Math.log1p(features.proxyOps) +
      0.58 * features.crisisProb +
      0.25 * features.scenarioPressure
  );

  const bandVariance = clamp(0.06 + features.eventSpikeRatio * 0.028, 0.06, 0.18) * stressTerm;

  return [
    {
      id: "iran_strike_7d",
      label: "Probability of Iran-linked strike",
      horizon_hours: 7 * 24,
      method: "Bayesian-weighted Monte Carlo",
      ...simulateProbabilityBand({
        base: clamp(pIranStrike * stressTerm, 0.01, 0.99),
        variance: bandVariance
      })
    },
    {
      id: "us_escalation_7d",
      label: "Probability of US escalation",
      horizon_hours: 7 * 24,
      method: "Bayesian-weighted Monte Carlo",
      ...simulateProbabilityBand({
        base: clamp(pUsEscalation * stressTerm, 0.01, 0.99),
        variance: bandVariance * 0.84
      })
    },
    {
      id: "shipping_disruption_7d",
      label: "Probability of shipping disruption",
      horizon_hours: 7 * 24,
      method: "Bayesian-weighted Monte Carlo",
      ...simulateProbabilityBand({
        base: clamp(pShippingDisruption * stressTerm, 0.01, 0.99),
        variance: bandVariance * 0.9
      })
    }
  ];
};

const buildTimeseriesProjection = ({ events, features }) => {
  const now = Date.now();
  const lookback = Math.max(24, config.predictionLookbackHours);
  const historyBins = Array.from({ length: lookback }, () => ({ signal: 0 }));

  for (const event of events.slice(0, 480)) {
    const deltaHours = Math.floor((now - new Date(event.timestamp).getTime()) / 3600000);
    if (deltaHours < 0 || deltaHours >= lookback) continue;
    const index = lookback - deltaHours - 1;
    const escalationBoost = hasEscalationKeyword(event) ? 1.05 : 0;
    const signal = 1 + event.impact_score / 60 + Math.max(0, -event.sentiment) * 1.5 + escalationBoost;
    historyBins[index].signal += signal;
  }

  const signalSeries = historyBins.map((bin) => bin.signal);
  const smoothed = smoothSeries(signalSeries, 0.34);
  const slope = linearTrendSlope(smoothed);
  const latest = smoothed[smoothed.length - 1] || 0;
  const maxSignal = Math.max(1, ...smoothed);

  const toEscalationIndex = (projectedSignal, hourAhead) => {
    const normalizedSignal = clamp(projectedSignal / (maxSignal * 1.45), 0, 1);
    const momentum = clamp(slope * 4, -0.4, 0.6);
    const hourDrift = clamp(hourAhead / 96, 0, 1);
    return clamp(
      24 +
        normalizedSignal * 44 +
        features.negSentiment * 16 +
        Math.log1p(features.eventSpikeRatio) * 8 +
        features.scenarioPressure * 12 +
        momentum * 14 +
        hourDrift * (features.scenarioPressure * 6),
      0,
      100
    );
  };

  const checkpoints = [6, 12, 24, 36, 48, 72];
  const forecast = checkpoints.map((hour) => {
    const projectedSignal = clamp(latest + slope * hour, 0, 1000);
    return {
      horizon_hours: hour,
      projected_signal: Number(projectedSignal.toFixed(2)),
      escalation_index: Number(toEscalationIndex(projectedSignal, hour).toFixed(2))
    };
  });

  const curve = Array.from({ length: 72 }, (_, index) => {
    const hour = index + 1;
    const projectedSignal = clamp(latest + slope * hour, 0, 1000);
    return {
      hour,
      escalation_index: Number(toEscalationIndex(projectedSignal, hour).toFixed(2))
    };
  });

  const peakPoint = curve.reduce((max, point) => (point.escalation_index > max.escalation_index ? point : max), curve[0] || { hour: 0, escalation_index: 0 });
  const trendLabel = slope > 0.18 ? "Escalating" : slope < -0.18 ? "Decaying" : "Stable / oscillating";

  return {
    method: "Exponential smoothing + trend projection",
    slope_per_hour: Number(slope.toFixed(4)),
    trend_label: trendLabel,
    peak_window: {
      hour: peakPoint.hour,
      escalation_index: peakPoint.escalation_index,
      summary: `Peak risk expected around next ${peakPoint.hour}h`
    },
    forecast,
    curve
  };
};

const buildEventChainProjection = ({ discreteEvent, features, scenario }) => {
  const chains = discreteEvent?.chains || [];
  const scenarioFactor = scenarioMultipliers[scenario] || 1;

  const transitions = chains.slice(0, 10).map((chain) => {
    const probability = clamp(chain.probability * (1 + features.eventSpikeRatio * 0.08) * (1 + features.scenarioPressure * 0.15), 1, 99);
    const impact = clamp(probability * 0.72 + features.highImpactRatio * 26 + features.negSentiment * 18, 4, 98);
    return {
      id: chain.id,
      transition: `${chain.from} -> ${chain.to}`,
      probability: Number(probability.toFixed(2)),
      eta_min: Math.max(3, Math.round(chain.next_eta_min / scenarioFactor)),
      projected_impact: Number(impact.toFixed(2))
    };
  });

  const pathwaySteps = [];
  if (transitions[0]) pathwaySteps.push(transitions[0]);
  if (transitions[1]) pathwaySteps.push(transitions[1]);
  if (transitions[2]) pathwaySteps.push(transitions[2]);

  const combinedProbability = pathwaySteps.reduce((acc, step) => acc * (step.probability / 100), 1) * 100;

  return {
    method: "Dynamic discrete-event chain projection",
    transitions,
    pathways: [
      {
        id: "path_primary",
        label: "Likely escalation path",
        steps: pathwaySteps,
        combined_probability: Number(clamp(combinedProbability, 0.1, 99).toFixed(2))
      }
    ]
  };
};

const buildPatternDetection = ({ features, risks }) => {
  const currentVector = {
    airOps: clamp(Math.log1p(features.airOps) / Math.log(10), 0, 1),
    proxyOps: clamp(Math.log1p(features.proxyOps) / Math.log(12), 0, 1),
    navalPressure: clamp(Math.log1p(features.navalOps) / Math.log(10), 0, 1),
    commodityShock: clamp(features.commodityShock, 0, 1),
    socialEscalation: clamp(Math.log1p(features.socialOps) / Math.log(12), 0, 1),
    negativeSentiment: clamp(features.negSentiment, 0, 1)
  };

  const matches = PATTERN_LIBRARY.map((pattern) => {
    const dims = Object.keys(pattern.vector);
    const distance = average(dims.map((dim) => Math.abs(currentVector[dim] - pattern.vector[dim])));
    const similarity = clamp(1 - distance, 0, 1);
    return {
      name: pattern.name,
      description: pattern.description,
      similarity: Number((similarity * 100).toFixed(2))
    };
  })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

  const label = risks.risk_score > 65 ? "Escalation" : risks.risk_score > 40 ? "Volatile / Uncertain" : "Contained";

  return {
    label,
    method: "Feature similarity classifier",
    matches,
    top_match: matches[0]?.name || "No strong match"
  };
};

const scoreEvidence = (event, predictionId) => {
  const text = toEventText(event);
  const keywords = PREDICTION_KEYWORDS[predictionId] || [];
  const keywordHits = keywords.filter((keyword) => text.includes(keyword)).length;

  const ageHours = Math.max(0, (Date.now() - new Date(event.timestamp).getTime()) / 3600000);
  const freshness = clamp(1 - ageHours / 72, 0, 1);
  const impact = clamp((event.impact_score || 0) / 100, 0, 1);
  const layerWeight = LAYER_WEIGHTS[event.metadata?.layer] || 0.5;
  const trust = clamp(event.metadata?.trust_score || 0.5, 0, 1);
  const keywordScore = clamp(keywordHits / 3, 0, 1);

  return impact * 0.33 + freshness * 0.24 + keywordScore * 0.23 + layerWeight * 0.1 + trust * 0.1;
};

const buildPredictionEvidence = ({ events, probabilistic }) => {
  const map = {};
  for (const prediction of probabilistic) {
    const id = prediction.id;
    const ranked = events
      .slice(0, 260)
      .map((event) => ({
        event_id: event.id,
        headline: event.headline,
        source: event.source,
        timestamp: event.timestamp,
        layer: event.metadata?.layer || "unknown",
        verification: event.metadata?.verification || "unknown",
        url: event.url,
        score: scoreEvidence(event, id)
      }))
      .filter((item) => item.score >= 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => ({
        ...item,
        score: Number((item.score * 100).toFixed(1))
      }));

    map[id] = ranked;
  }

  return map;
};

const buildTopSignals = ({ features, clusterRegion }) => {
  const candidates = [
    {
      key: "air",
      label: "Air/radar activity increased",
      value: `+${Math.round(clamp((features.airOps / 14) * 100, 0, 100))}% radar-air signal density`,
      contribution: clamp(features.airOps / 14, 0, 1)
    },
    {
      key: "keywords",
      label: "Escalation language spike",
      value: `+${Math.round(clamp(features.escalationKeywordRatio * 100, 0, 100))}% escalation-keyword share`,
      contribution: clamp(features.escalationKeywordRatio * 1.4, 0, 1)
    },
    {
      key: "cluster",
      label: "Incident clustering detected",
      value: `Cluster concentration in ${clusterRegion}`,
      contribution: clamp(features.clusterRatio * 2, 0, 1)
    },
    {
      key: "social",
      label: "Social escalation pressure",
      value: `${features.socialOps} high-velocity social signals`,
      contribution: clamp(Math.log1p(features.socialOps) / Math.log(10), 0, 1)
    },
    {
      key: "commodity",
      label: "Energy/commodity stress",
      value: `${Math.round(features.commodityShock * 100)}% commodity-shock intensity`,
      contribution: clamp(features.commodityShock, 0, 1)
    }
  ];

  return candidates
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((item) => ({
      ...item,
      contribution_pct: Math.round(item.contribution * 100)
    }));
};

const buildRecommendedActions = ({ probabilistic, chainProjection, timeseries }) => {
  const byId = Object.fromEntries(probabilistic.map((item) => [item.id, item]));
  const actions = [];

  const shipping = byId.shipping_disruption_7d?.probability || 0;
  const iran = byId.iran_strike_7d?.probability || 0;
  const us = byId.us_escalation_7d?.probability || 0;
  const peakHour = timeseries?.peak_window?.hour || 24;

  if (shipping >= 35) {
    actions.push({
      priority: "high",
      title: "Monitor Strait of Hormuz and tanker lanes",
      rationale: `Shipping disruption probability at ${shipping.toFixed(1)}% with elevated event-chain pressure.`
    });
    actions.push({
      priority: "high",
      title: "Hedge energy exposure",
      rationale: "Commodity-linked disruption probability suggests near-term oil volatility risk."
    });
  }

  if (iran >= 40 || us >= 35) {
    actions.push({
      priority: "high",
      title: "Raise regional alert posture",
      rationale: `Escalation probabilities (Iran ${iran.toFixed(1)}%, US ${us.toFixed(1)}%) exceed watch threshold.`
    });
  }

  actions.push({
    priority: peakHour <= 36 ? "high" : "medium",
    title: "Focus intelligence collection on peak window",
    rationale: `Projected peak risk window is around next ${peakHour}h.`
  });

  if (chainProjection?.pathways?.[0]?.steps?.length) {
    actions.push({
      priority: "medium",
      title: "Track projected event chain",
      rationale: `${chainProjection.pathways[0].steps.length} linked transitions currently dominate propagation.`
    });
  }

  return actions.slice(0, 5);
};

const buildConfidence = ({ events, probabilistic }) => {
  const recent = events.slice(0, 240);
  if (!recent.length) {
    return {
      score: 0.32,
      data_completeness: 0.2,
      signal_agreement: 0.4,
      model_variance: 0.7,
      source_diversity: 0.2,
      layer_coverage: 0.2
    };
  }

  const sources = new Set();
  const layers = new Set();
  let highTrust = 0;

  for (const event of recent) {
    if (event.source) sources.add(event.source);
    if (event.metadata?.layer) layers.add(event.metadata.layer);
    if ((event.metadata?.trust_score || 0) >= 0.78) highTrust += 1;
  }

  const dataCompleteness = clamp(recent.length / 180, 0, 1);
  const sourceDiversity = clamp(sources.size / 28, 0, 1);
  const layerCoverage = clamp(layers.size / 9, 0, 1);
  const highTrustRatio = clamp(highTrust / recent.length, 0, 1);

  const avgBandWidth = average(probabilistic.map((item) => Math.abs(item.p90 - item.p10))) / 100;
  const modelVariance = clamp(avgBandWidth, 0, 1);
  const signalAgreement = clamp(1 - modelVariance * 0.9, 0.05, 1);

  const score = clamp(
    0.25 + dataCompleteness * 0.24 + sourceDiversity * 0.18 + layerCoverage * 0.15 + highTrustRatio * 0.2 + signalAgreement * 0.13,
    0.3,
    0.95
  );

  return {
    score: Number(score.toFixed(3)),
    data_completeness: Number(dataCompleteness.toFixed(3)),
    signal_agreement: Number(signalAgreement.toFixed(3)),
    model_variance: Number(modelVariance.toFixed(3)),
    source_diversity: Number(sourceDiversity.toFixed(3)),
    layer_coverage: Number(layerCoverage.toFixed(3))
  };
};

export const runPredictionEngine = ({ events, simulations, risks, scenario }) => {
  const macroBars = simulations?.macroIndicators?.bars || [];
  const features = buildFeatureVector({
    events,
    macroBars,
    risks,
    scenario
  });

  const probabilistic = buildProbabilisticProjection({ features, scenario });
  const timeseries = buildTimeseriesProjection({ events, features });
  const eventChains = buildEventChainProjection({
    discreteEvent: simulations?.discreteEvent,
    features,
    scenario
  });
  const pattern = buildPatternDetection({ features, risks });
  const topSignals = buildTopSignals({
    features,
    clusterRegion: features.clusterRegion
  });
  const evidence = buildPredictionEvidence({ events, probabilistic });
  const recommendedActions = buildRecommendedActions({
    probabilistic,
    chainProjection: eventChains,
    timeseries
  });
  const confidence = buildConfidence({ events, probabilistic });

  const topRisk = probabilistic.reduce((max, item) => (item.probability > max.probability ? item : max), probabilistic[0]);
  const impactIndex = clamp(risks.risk_score * 0.6 + (topRisk?.probability || 0) * 0.4, 0, 100);

  return {
    timestamp: new Date().toISOString(),
    scenario,
    confidence: confidence.score,
    confidence_breakdown: confidence,
    headline_projection: `${topRisk.label}: ${topRisk.probability}% in ${Math.round(topRisk.horizon_hours / 24)}d`,
    probabilistic,
    timeseries,
    event_chains: eventChains,
    pattern_detection: pattern,
    why_this_prediction: {
      summary: "Predictions are currently driven by concentrated escalation signals, event clustering, and propagation pressure.",
      top_signals: topSignals
    },
    prediction_evidence: evidence,
    recommended_actions: recommendedActions,
    risk_standardization: {
      risk_score_0_100: Number((risks.risk_score || 0).toFixed(2)),
      confidence_band_avg: Number(average(probabilistic.map((item) => Math.abs(item.p90 - item.p10))).toFixed(2)),
      impact_index_0_100: Number(impactIndex.toFixed(2)),
      impact_scale: impactIndex >= 70 ? "Severe" : impactIndex >= 45 ? "Elevated" : "Contained"
    },
    decision_layer: {
      why: topSignals.map((signal) => `${signal.label}: ${signal.value}`),
      what_next: {
        likely_path: eventChains.pathways?.[0] || { label: "No dominant path", steps: [], combined_probability: 0 },
        peak_risk_window: timeseries.peak_window,
        impact_zones: [features.clusterRegion]
      }
    },
    drivers: [
      `Negative sentiment signal: ${(features.negSentiment * 100).toFixed(1)}%`,
      `High-impact event ratio: ${(features.highImpactRatio * 100).toFixed(1)}%`,
      `Event spike ratio: ${features.eventSpikeRatio.toFixed(2)}x`,
      `Air/Naval signals: ${features.airOps}/${features.navalOps}`,
      `Social escalation signals: ${features.socialOps}`
    ],
    assumptions: [
      "Probabilities are conditional under current data quality and source coverage.",
      "Military deception and sensor gaps can shift outcomes quickly.",
      "Predictions are continuously recomputed as new events stream in."
    ]
  };
};
