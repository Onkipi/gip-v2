import { randomUUID } from "crypto";
import { config } from "./config.js";
import { ingestLiveEvents } from "./ingestion-service.js";
import { fetchMacroIndicators } from "./providers/macro-provider.js";
import { runRollingMonteCarlo } from "./simulation/monte-carlo.js";
import { buildDynamicEventSimulation } from "./simulation/discrete-event.js";
import { computeIntelligence } from "./simulation/intelligence.js";
import { runPredictionEngine } from "./simulation/prediction-engine.js";

const allowedScenarios = new Set(["baseline", "crisis", "extreme"]);

export class RealtimeEngine {
  constructor({ io, redisLayer, snapshotStore }) {
    this.io = io;
    this.redisLayer = redisLayer;
    this.snapshotStore = snapshotStore;
    this.instanceId = `engine_${randomUUID()}`;
    this.intervalRef = null;
    this.isRunning = false;
    this.cycleInFlight = false;
    this.lastAlertAt = 0;
    this.unsubscribeRedis = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.unsubscribeRedis = this.redisLayer.subscribe((envelope) => {
      if (!envelope || envelope.origin === this.instanceId) return;
      this.io.emit(envelope.topic, envelope.payload);
    });

    this.runCycle();
    this.intervalRef = setInterval(() => this.runCycle(), config.ingestIntervalMs);
  }

  async stop() {
    this.isRunning = false;
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }

    if (this.unsubscribeRedis) {
      this.unsubscribeRedis();
      this.unsubscribeRedis = null;
    }
  }

  getScenario() {
    return this.snapshotStore.getSnapshot().scenario;
  }

  async setScenario(nextScenario) {
    if (!allowedScenarios.has(nextScenario)) {
      return false;
    }

    this.snapshotStore.setScenario(nextScenario);
    await this.publishAndBroadcast("scenario_update", {
      scenario: nextScenario,
      timestamp: new Date().toISOString()
    });

    await this.runSimulationOnly();
    return true;
  }

  async publishAndBroadcast(topic, payload) {
    this.io.emit(topic, payload);
    await this.redisLayer.publish(topic, payload, this.instanceId);
  }

  async runCycle() {
    if (this.cycleInFlight) return;
    this.cycleInFlight = true;

    try {
      const [newEvents, macroIndicators] = await Promise.all([
        ingestLiveEvents(),
        fetchMacroIndicators()
      ]);

      if (newEvents.length) {
        const appended = this.snapshotStore.appendEvents(newEvents);

        for (const event of appended) {
          await this.redisLayer.pushEvent(event);
        }

        if (appended.length) {
          await this.publishAndBroadcast("news_update", appended);
        }
      }

      if (macroIndicators?.bars?.length) {
        this.snapshotStore.setMacroIndicators(macroIndicators);
        await this.publishAndBroadcast("macro_update", macroIndicators);
      }

      await this.runSimulationOnly();
    } finally {
      this.cycleInFlight = false;
    }
  }

  async runSimulationOnly() {
    const snapshot = this.snapshotStore.getSnapshot();

    const monteCarlo = runRollingMonteCarlo({
      events: snapshot.events,
      previousSimulation: snapshot.simulations.monteCarlo,
      iterations: config.monteCarloIterations,
      scenario: snapshot.scenario
    });

    const discreteEvent = buildDynamicEventSimulation({
      events: snapshot.events,
      scenario: snapshot.scenario
    });

    const simulations = {
      monteCarlo,
      discreteEvent,
      macroIndicators: snapshot.macroIndicators,
      generatedAt: new Date().toISOString()
    };

    const risks = computeIntelligence({
      events: snapshot.events,
      simulation: simulations,
      scenario: snapshot.scenario
    });
    const predictions = runPredictionEngine({
      events: snapshot.events,
      simulations,
      risks,
      scenario: snapshot.scenario
    });

    this.snapshotStore.setSimulations(simulations);
    this.snapshotStore.setRisks(risks);
    this.snapshotStore.setPredictions(predictions);

    await this.publishAndBroadcast("simulation_update", simulations);
    await this.publishAndBroadcast("prediction_update", predictions);

    const payload = {
      ...risks,
      alerts: this.snapshotStore.getSnapshot().alerts.slice(0, 20)
    };
    await this.publishAndBroadcast("risk_update", payload);

    await this.triggerAlertIfNeeded(risks);
  }

  async triggerAlertIfNeeded(risks) {
    const now = Date.now();
    const shouldAlert = risks.risk_score >= config.riskAlertThreshold || risks.anomaly_score >= 80;

    if (!shouldAlert) return;
    if (now - this.lastAlertAt < config.riskCooldownMs) return;

    this.lastAlertAt = now;

    const alert = {
      id: `alert_${now}`,
      severity: risks.risk_level,
      title: "Risk threshold breached",
      message: `Risk score at ${risks.risk_score} with anomaly score ${risks.anomaly_score}.`,
      timestamp: new Date(now).toISOString(),
      risk_score: risks.risk_score
    };

    this.snapshotStore.addAlert(alert);

    await this.publishAndBroadcast("alert_update", alert);
    await this.publishAndBroadcast("risk_update", {
      ...risks,
      alerts: this.snapshotStore.getSnapshot().alerts.slice(0, 20)
    });
  }
}

export const createRealtimeEngine = (deps) => new RealtimeEngine(deps);
