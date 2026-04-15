"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket-client";
import { useIntelStore } from "@/store/intel-store";

export const useRealtimeSocket = () => {
  useEffect(() => {
    const socket = getSocket();

    const { setConnected, pushEvents, setSimulations, setRisks, setMacroIndicators, setPredictions, pushAlert, setScenario, bootstrap } = useIntelStore.getState();
    const pendingNews = [];
    let flushTimer = null;

    const flushNews = () => {
      if (!pendingNews.length) return;
      pushEvents(pendingNews.splice(0, pendingNews.length));
      flushTimer = null;
    };

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onNewsUpdate = (payload) => {
      if (Array.isArray(payload)) {
        pendingNews.push(...payload);
      } else if (payload) {
        pendingNews.push(payload);
      }

      if (!flushTimer) {
        flushTimer = setTimeout(flushNews, 120);
      }
    };
    const onSimulationUpdate = (simulation) => setSimulations(simulation);
    const onPredictionUpdate = (predictionPayload) => setPredictions(predictionPayload);
    const onRiskUpdate = (riskPayload) => setRisks(riskPayload);
    const onMacroUpdate = (macroPayload) => setMacroIndicators(macroPayload);
    const onAlertUpdate = (alert) => pushAlert(alert);
    const onScenarioUpdate = (payload) => setScenario(payload.scenario);
    const onBootstrap = (payload) => bootstrap(payload);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("news_update", onNewsUpdate);
    socket.on("simulation_update", onSimulationUpdate);
    socket.on("prediction_update", onPredictionUpdate);
    socket.on("risk_update", onRiskUpdate);
    socket.on("macro_update", onMacroUpdate);
    socket.on("alert_update", onAlertUpdate);
    socket.on("scenario_update", onScenarioUpdate);
    socket.on("bootstrap", onBootstrap);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushNews();
      }
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("news_update", onNewsUpdate);
      socket.off("simulation_update", onSimulationUpdate);
      socket.off("prediction_update", onPredictionUpdate);
      socket.off("risk_update", onRiskUpdate);
      socket.off("macro_update", onMacroUpdate);
      socket.off("alert_update", onAlertUpdate);
      socket.off("scenario_update", onScenarioUpdate);
      socket.off("bootstrap", onBootstrap);
    };
  }, []);

  return getSocket();
};
