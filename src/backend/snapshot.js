import { config } from "./config.js";

const defaultSimulations = {
  monteCarlo: {
    timestamp: new Date(0).toISOString(),
    iterations: 0,
    scenario: "baseline",
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

const defaultRisks = {
  geopolitical_tension_index: 32,
  market_stress_index: 29,
  anomaly_score: 8,
  risk_score: 26,
  risk_level: "low",
  details: {}
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

class SnapshotStore {
  constructor() {
    this.state = {
      events: [],
      simulations: defaultSimulations,
      risks: defaultRisks,
      macroIndicators: defaultMacroIndicators,
      predictions: defaultPredictions,
      alerts: [],
      scenario: "baseline",
      updatedAt: new Date().toISOString()
    };
  }

  touch() {
    this.state.updatedAt = new Date().toISOString();
  }

  appendEvents(events = []) {
    if (!events.length) return [];
    const existingKeys = new Set(
      this.state.events.map((event) => event.id || `${event.headline}:${event.source}:${event.timestamp}`)
    );
    const merged = [...events, ...this.state.events];
    const deduped = [];
    const seen = new Set();
    const added = [];

    for (const event of merged) {
      const key = event.id || `${event.headline}:${event.source}:${event.timestamp}`;
      if (seen.has(key)) continue;
      deduped.push(event);
      seen.add(key);
      if (!existingKeys.has(key)) {
        added.push(event);
      }
      if (deduped.length >= config.maxEvents) break;
    }

    this.state.events = deduped;
    this.touch();
    return added;
  }

  setSimulations(simulations) {
    this.state.simulations = simulations;
    this.touch();
  }

  setRisks(risks) {
    this.state.risks = risks;
    this.touch();
  }

  setMacroIndicators(macroIndicators) {
    this.state.macroIndicators = macroIndicators;
    this.touch();
  }

  setPredictions(predictions) {
    this.state.predictions = predictions;
    this.touch();
  }

  addAlert(alert) {
    this.state.alerts = [alert, ...this.state.alerts].slice(0, 120);
    this.touch();
  }

  setScenario(scenario) {
    this.state.scenario = scenario;
    this.touch();
  }

  getEvents(limit = config.historyLimit) {
    return this.state.events.slice(0, limit);
  }

  getSnapshot() {
    return structuredClone(this.state);
  }
}

const snapshotStoreSingleton = globalThis.__INTEL_SNAPSHOT_STORE__ || new SnapshotStore();

if (!globalThis.__INTEL_SNAPSHOT_STORE__) {
  globalThis.__INTEL_SNAPSHOT_STORE__ = snapshotStoreSingleton;
}

export const snapshotStore = snapshotStoreSingleton;
