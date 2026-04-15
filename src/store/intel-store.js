import { create } from "zustand";

const eventKey = (event) => event.url || event.id || `${event.headline}:${event.source}`;

const dedupeEvents = (events = [], limit = 550) => {
  const seen = new Set();
  const result = [];
  for (const event of events) {
    const key = eventKey(event);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(event);
    if (result.length >= limit) break;
  }
  return result;
};

const defaultRisks = {
  geopolitical_tension_index: 32,
  market_stress_index: 28,
  anomaly_score: 6,
  risk_score: 24,
  risk_level: "low",
  details: {}
};

const defaultSimulations = {
  monteCarlo: {
    timestamp: new Date(0).toISOString(),
    scenario: "baseline",
    iterations: 0,
    outcomeProbabilities: [
      { name: "Stability", value: 60 },
      { name: "Tension", value: 28 },
      { name: "Crisis", value: 12 }
    ],
    timeseries: []
  },
  discreteEvent: {
    timestamp: new Date(0).toISOString(),
    graph: { nodes: [], edges: [] },
    chains: []
  }
};

const defaultMacroIndicators = {
  timestamp: new Date(0).toISOString(),
  source: "bootstrap",
  bars: [
    { name: "Crude Oil", value: 81.4, unit: "USD / bbl", category: "commodity", changePct: 0, source: "bootstrap" },
    { name: "Food (Wheat)", value: 6.7, unit: "USD / bushel", category: "commodity", changePct: 0, source: "bootstrap" },
    { name: "USD", value: 1, unit: "base", category: "currency", changePct: 0, source: "bootstrap" },
    { name: "INR", value: 83.2, unit: "per USD", category: "currency", changePct: 0, source: "bootstrap" },
    { name: "AED", value: 3.67, unit: "per USD", category: "currency", changePct: 0, source: "bootstrap" }
  ]
};

const defaultPredictions = {
  timestamp: new Date(0).toISOString(),
  scenario: "baseline",
  confidence: 0.32,
  headline_projection: "Awaiting live data for projection",
  probabilistic: [],
  timeseries: {
    method: "Exponential smoothing + trend projection",
    slope_per_hour: 0,
    trend_label: "Stable / oscillating",
    peak_window: {
      hour: 0,
      escalation_index: 0,
      summary: ""
    },
    forecast: [],
    curve: []
  },
  event_chains: {
    method: "Dynamic discrete-event chain projection",
    transitions: [],
    pathways: []
  },
  pattern_detection: {
    label: "Uncertain",
    method: "Feature similarity classifier",
    matches: [],
    top_match: "No strong match"
  },
  why_this_prediction: {
    summary: "",
    top_signals: []
  },
  prediction_evidence: {},
  recommended_actions: [],
  confidence_breakdown: {
    data_completeness: 0,
    signal_agreement: 0,
    model_variance: 1,
    source_diversity: 0,
    layer_coverage: 0
  },
  risk_standardization: {
    risk_score_0_100: 0,
    confidence_band_avg: 0,
    impact_index_0_100: 0,
    impact_scale: "Contained"
  },
  decision_layer: {
    why: [],
    what_next: {
      likely_path: { label: "No dominant path", steps: [], combined_probability: 0 },
      peak_risk_window: { hour: 0, escalation_index: 0, summary: "" },
      impact_zones: []
    }
  },
  drivers: [],
  assumptions: []
};

export const useIntelStore = create((set) => ({
  connected: false,
  events: [],
  simulations: defaultSimulations,
  risks: defaultRisks,
  macroIndicators: defaultMacroIndicators,
  predictions: defaultPredictions,
  alerts: [],
  scenario: "baseline",
  updatedAt: null,

  bootstrap: (payload) =>
    set(() => ({
      events: dedupeEvents(payload.events || [], 550),
      simulations: payload.simulations || defaultSimulations,
      risks: payload.risks || defaultRisks,
      macroIndicators: payload.macroIndicators || defaultMacroIndicators,
      predictions: payload.predictions || defaultPredictions,
      alerts: payload.alerts || [],
      scenario: payload.scenario || "baseline",
      updatedAt: payload.updatedAt || new Date().toISOString()
    })),

  pushEvent: (event) =>
    set((state) => ({
      events: dedupeEvents([event, ...state.events], 550),
      updatedAt: new Date().toISOString()
    })),

  pushEvents: (events) =>
    set((state) => ({
      events: dedupeEvents([...(events || []), ...state.events], 550),
      updatedAt: new Date().toISOString()
    })),

  setSimulations: (simulations) =>
    set(() => ({
      simulations,
      updatedAt: new Date().toISOString()
    })),

  setMacroIndicators: (macroIndicators) =>
    set(() => ({
      macroIndicators,
      updatedAt: new Date().toISOString()
    })),

  setPredictions: (predictions) =>
    set(() => ({
      predictions,
      updatedAt: new Date().toISOString()
    })),

  setRisks: (risksPayload) =>
    set((state) => ({
      risks: {
        geopolitical_tension_index: risksPayload.geopolitical_tension_index,
        market_stress_index: risksPayload.market_stress_index,
        anomaly_score: risksPayload.anomaly_score,
        risk_score: risksPayload.risk_score,
        risk_level: risksPayload.risk_level,
        details: risksPayload.details || {}
      },
      alerts: Array.isArray(risksPayload.alerts) ? risksPayload.alerts : state.alerts,
      updatedAt: new Date().toISOString()
    })),

  pushAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 120),
      updatedAt: new Date().toISOString()
    })),

  setConnected: (connected) => set(() => ({ connected })),
  setScenario: (scenario) => set(() => ({ scenario }))
}));
