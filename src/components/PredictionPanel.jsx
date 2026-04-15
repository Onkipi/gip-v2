"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatStableUtcTime = (iso) => {
  if (!iso) return "--";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "--";
  return `${date.toISOString().slice(11, 19)} UTC`;
};

const ProxyToggle = ({ value, onChange }) => {
  const levels = ["low", "medium", "high"];
  return (
    <div className="grid grid-cols-3 gap-1">
      {levels.map((level) => {
        const active = value === level;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase ${
              active ? "border-cyan-400 bg-cyan-500/20 text-cyan-300" : "border-slate-600 text-slate-300"
            }`}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
};

const ProbabilityRow = ({ item, adjusted }) => {
  const delta = adjusted.probability - item.probability;
  const deltaText = `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%`;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-200">{item.label}</span>
        <span className="text-slate-400">{Math.round(item.horizon_hours / 24)}d</span>
      </div>
      <p className="text-base font-semibold text-cyan-300">{adjusted.probability.toFixed(2)}%</p>
      <p className="text-[10px] text-slate-500">
        P10 {adjusted.p10.toFixed(1)}% · P90 {adjusted.p90.toFixed(1)}% · Shift {deltaText}
      </p>
    </div>
  );
};

export const PredictionPanel = ({ predictions, onSelectEvidence }) => {
  const [carrierDeployed, setCarrierDeployed] = useState(false);
  const [proxyActivation, setProxyActivation] = useState("medium");
  const [oilRoutesDisrupted, setOilRoutesDisrupted] = useState(false);
  const [selectedPredictionId, setSelectedPredictionId] = useState("iran_strike_7d");
  const [nowMs, setNowMs] = useState(null);

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const confidencePct = Number((Number(predictions?.confidence || 0) * 100).toFixed(1));
  const probabilistic = predictions?.probabilistic || [];
  const chainTransitions = predictions?.event_chains?.transitions || [];
  const pathway = predictions?.event_chains?.pathways?.[0];
  const forecast = predictions?.timeseries?.forecast || [];
  const curve = predictions?.timeseries?.curve || [];
  const topPattern = predictions?.pattern_detection?.matches?.[0];
  const topSignals = predictions?.why_this_prediction?.top_signals || [];
  const recommendedActions = predictions?.recommended_actions || [];
  const confidenceBreakdown = predictions?.confidence_breakdown || {};
  const riskStandardization = predictions?.risk_standardization || {};

  useEffect(() => {
    if (!probabilistic.length) return;
    const ids = probabilistic.map((item) => item.id);
    if (!ids.includes(selectedPredictionId)) {
      setSelectedPredictionId(ids[0]);
    }
  }, [probabilistic, selectedPredictionId]);

  const adjustedProbabilities = useMemo(() => {
    const proxyShift = proxyActivation === "high" ? 9 : proxyActivation === "medium" ? 4 : -2;

    const adjustProbability = (item) => {
      let shift = 0;

      if (carrierDeployed) {
        if (item.id === "us_escalation_7d") shift += 11;
        if (item.id === "iran_strike_7d") shift += 4;
        if (item.id === "shipping_disruption_7d") shift += 3;
      }

      if (item.id === "iran_strike_7d") shift += proxyShift;
      if (item.id === "shipping_disruption_7d") shift += proxyShift * 0.7;

      if (oilRoutesDisrupted) {
        if (item.id === "shipping_disruption_7d") shift += 14;
        if (item.id === "iran_strike_7d") shift += 4;
        if (item.id === "us_escalation_7d") shift += 5;
      }

      const probability = clamp(item.probability + shift, 0.5, 99);
      const p10 = clamp(item.p10 + shift * 0.75, 0.1, 98);
      const p90 = clamp(item.p90 + shift * 1.1, p10 + 0.5, 99.9);

      return {
        ...item,
        probability: Number(probability.toFixed(2)),
        p10: Number(p10.toFixed(2)),
        p90: Number(p90.toFixed(2))
      };
    };

    return probabilistic.map(adjustProbability);
  }, [probabilistic, carrierDeployed, proxyActivation, oilRoutesDisrupted]);

  const updatedAt = formatStableUtcTime(predictions?.timestamp);
  const scenario = predictions?.scenario || "baseline";
  const updatedAgo = nowMs && predictions?.timestamp
    ? Math.max(0, Math.floor((nowMs - new Date(predictions.timestamp).getTime()) / 1000))
    : null;

  const selectedEvidence = predictions?.prediction_evidence?.[selectedPredictionId] || [];

  return (
    <section className="mt-4 border-t border-slate-700 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Prediction Engine</h4>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${updatedAgo !== null && updatedAgo < 10 ? "animate-pulse bg-emerald-400" : "bg-slate-500"}`} />
          <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">Confidence {confidencePct}%</span>
        </div>
      </div>

      <p className="mb-1 text-[10px] text-slate-500">Updated {updatedAt} · Scenario {scenario}</p>
      <p className="mb-2 text-[10px] text-slate-500">Last refresh {updatedAgo === null ? "--" : `${updatedAgo}s ago`}</p>
      <p className="mb-2 text-[11px] text-slate-300">{predictions?.headline_projection || "Awaiting live projection data"}</p>

      <div className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5">
        <p className="text-[11px] text-slate-400">Why this prediction</p>
        <p className="mt-1 text-[11px] text-slate-300">{predictions?.why_this_prediction?.summary || "Signal drivers loading..."}</p>
        <div className="mt-2 space-y-1">
          {topSignals.slice(0, 3).map((signal) => (
            <div key={signal.key} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300">
              <p className="font-semibold text-slate-200">{signal.label}</p>
              <p>{signal.value}</p>
              <p className="text-slate-500">Contribution {signal.contribution_pct}%</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5">
        <p className="text-[11px] text-slate-400">What-if simulation</p>
        <div className="mt-2 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setCarrierDeployed((current) => !current)}
            className={`rounded border px-2 py-1 text-[10px] font-semibold ${carrierDeployed ? "border-cyan-400 bg-cyan-500/20 text-cyan-300" : "border-slate-600 text-slate-300"}`}
          >
            US carrier {carrierDeployed ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => setOilRoutesDisrupted((current) => !current)}
            className={`rounded border px-2 py-1 text-[10px] font-semibold ${oilRoutesDisrupted ? "border-cyan-400 bg-cyan-500/20 text-cyan-300" : "border-slate-600 text-slate-300"}`}
          >
            Oil routes {oilRoutesDisrupted ? "YES" : "NO"}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Iran proxy activation</p>
        <ProxyToggle value={proxyActivation} onChange={setProxyActivation} />
      </div>

      <div className="mt-3 space-y-2">
        {probabilistic.slice(0, 3).map((item) => {
          const adjusted = adjustedProbabilities.find((entry) => entry.id === item.id) || item;
          return <ProbabilityRow key={item.id} item={item} adjusted={adjusted} />;
        })}
      </div>

      <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">Time-series escalation curve</p>
          <span className="text-[10px] text-slate-500">{predictions?.timeseries?.trend_label || "trend"}</span>
        </div>
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}`, "Escalation Index"]}
                labelFormatter={(label) => `+${label}h`}
              />
              <Line type="monotone" dataKey="escalation_index" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">{predictions?.timeseries?.peak_window?.summary || "Peak window loading..."}</p>
        <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-slate-300">
          {forecast.slice(0, 3).map((point) => (
            <div key={point.horizon_hours} className="rounded border border-slate-700 px-1.5 py-1">
              <p>{point.horizon_hours}h</p>
              <p className="font-semibold text-cyan-300">{point.escalation_index.toFixed(1)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5">
        <p className="text-[11px] text-slate-400">Prediction evidence graph</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {probabilistic.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedPredictionId(item.id)}
              className={`rounded border px-2 py-0.5 text-[10px] ${selectedPredictionId === item.id ? "border-cyan-400 text-cyan-300" : "border-slate-600 text-slate-300"}`}
            >
              {item.label.replace("Probability of ", "")}
            </button>
          ))}
        </div>
        <div className="mt-2 space-y-1">
          {selectedEvidence.slice(0, 4).map((item) => (
            <button
              key={`${item.event_id}_${item.score}`}
              type="button"
              onClick={() => onSelectEvidence?.(item.event_id)}
              className="block w-full rounded border border-slate-700 px-2 py-1 text-left text-[10px] text-slate-300 hover:border-cyan-400"
            >
              <p className="font-semibold text-slate-200">{item.headline}</p>
              <p>{item.source} · {item.layer} · relevance {item.score}</p>
            </button>
          ))}
          {!selectedEvidence.length ? <p className="text-[10px] text-slate-500">No linked evidence yet</p> : null}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5">
        <p className="text-[11px] text-slate-400">Why + What next</p>
        <div className="mt-1 text-[10px] text-slate-300">
          {(predictions?.decision_layer?.why || []).slice(0, 3).map((line) => (
            <p key={line}>- {line}</p>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-slate-300">
          <p className="font-semibold text-slate-200">Likely escalation path</p>
          {(pathway?.steps || chainTransitions.slice(0, 3)).map((step, idx) => (
            <p key={`${step.id || idx}_${step.transition}`}>- {step.transition} ({step.probability.toFixed(1)}%, ETA {step.eta_min}m)</p>
          ))}
          <p className="text-slate-500">Path probability {pathway?.combined_probability?.toFixed?.(1) || "--"}%</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5">
        <p className="text-[11px] text-slate-400">Recommended actions</p>
        <div className="mt-1 space-y-1 text-[10px] text-slate-300">
          {recommendedActions.slice(0, 4).map((action) => (
            <div key={`${action.title}_${action.priority}`} className="rounded border border-slate-700 px-2 py-1">
              <p className="font-semibold text-slate-200">{action.title}</p>
              <p>{action.rationale}</p>
              <p className="text-slate-500">Priority: {action.priority}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5">
        <p className="text-[11px] text-slate-400">Confidence explanation</p>
        <p className="mt-1 text-[10px] text-slate-300">Data completeness {(Number(confidenceBreakdown.data_completeness || 0) * 100).toFixed(1)}%</p>
        <p className="text-[10px] text-slate-300">Signal agreement {(Number(confidenceBreakdown.signal_agreement || 0) * 100).toFixed(1)}%</p>
        <p className="text-[10px] text-slate-300">Model variance {(Number(confidenceBreakdown.model_variance || 0) * 100).toFixed(1)}%</p>
      </div>

      <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5">
        <p className="text-[11px] text-slate-400">Standardized risk view</p>
        <p className="text-[10px] text-slate-300">Risk score: {Number(riskStandardization.risk_score_0_100 || 0).toFixed(2)} / 100</p>
        <p className="text-[10px] text-slate-300">Confidence band width: {Number(riskStandardization.confidence_band_avg || 0).toFixed(2)}</p>
        <p className="text-[10px] text-slate-300">Impact scale: {riskStandardization.impact_scale || "--"} ({Number(riskStandardization.impact_index_0_100 || 0).toFixed(2)})</p>
      </div>

      <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5">
        <p className="text-[11px] text-slate-400">Pattern detection</p>
        <p className="mt-1 text-xs text-slate-200">{predictions?.pattern_detection?.label || "Uncertain"}</p>
        <p className="text-[11px] text-slate-400">{topPattern ? `${topPattern.name} (${topPattern.similarity.toFixed(1)}%)` : "No strong match"}</p>
      </div>
    </section>
  );
};
