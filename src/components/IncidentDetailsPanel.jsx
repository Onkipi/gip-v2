"use client";

import { formatEventTime, getPriorityLevel, priorityStyles } from "@/lib/event-utils";
import { PredictionPanel } from "@/components/PredictionPanel";

const MacroPill = ({ item }) => {
  const positive = Number(item.changePct || 0) >= 0;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1">
      <p className="text-[11px] text-slate-400">{item.name}</p>
      <p className="text-sm font-semibold text-slate-100">
        {item.value} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
      </p>
      <p className={`text-[10px] ${positive ? "text-emerald-400" : "text-red-400"}`}>
        {positive ? "+" : ""}
        {item.changePct.toFixed(3)}%
      </p>
    </div>
  );
};

export const IncidentDetailsPanel = ({ event, macroIndicators, risks, predictions, onFocusMap, onSelectEvidence }) => {
  if (!event) {
    return (
      <aside className="h-full overflow-y-auto rounded-2xl border border-slate-600/60 bg-slate-900/95 p-3 text-slate-300 shadow-2xl">
        <p className="text-sm">Select an incident to view details.</p>
        <PredictionPanel predictions={predictions} onSelectEvidence={onSelectEvidence} />
      </aside>
    );
  }

  const level = getPriorityLevel(event);
  const style = priorityStyles[level];

  return (
    <aside className="h-full overflow-y-auto rounded-2xl border border-slate-600/60 bg-slate-900/95 p-3 text-slate-100 shadow-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Incident Details</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>{style.label}</span>
      </div>

      <p className="text-sm font-semibold">{event.headline}</p>
      <p className="mt-1 text-xs text-slate-400">
        {event.location_label || event.region} • {formatEventTime(event.timestamp)}
      </p>

      {event.summary ? <p className="mt-2 text-sm text-slate-300">{event.summary}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full border border-slate-600 px-2 py-0.5 text-slate-300">{event.source}</span>
        <span className="rounded-full border border-slate-600 px-2 py-0.5 text-slate-300">{event.category}</span>
        <span className="rounded-full border border-slate-600 px-2 py-0.5 text-slate-300">
          {event.metadata?.verification || "verification unknown"}
        </span>
        <span className="rounded-full border border-slate-600 px-2 py-0.5 text-slate-300">Impact {event.impact_score}</span>
        <span className="rounded-full border border-slate-600 px-2 py-0.5 text-slate-300">Sentiment {event.sentiment.toFixed(2)}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onFocusMap}
          className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-400"
        >
          Focus On Map
        </button>
        {event.url ? (
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Source
          </a>
        ) : null}
      </div>

      <PredictionPanel predictions={predictions} onSelectEvidence={onSelectEvidence} />

      <div className="mt-4 border-t border-slate-700 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Live Macro Monitor</h4>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              macroIndicators?.stale ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {macroIndicators?.stale ? "Cached" : "Live"}
          </span>
        </div>
        <p className="mb-1 text-[10px] text-slate-500">
          {macroIndicators?.source || "unknown"} • {macroIndicators?.timestamp ? new Date(macroIndicators.timestamp).toLocaleTimeString() : "--"}
        </p>
        {macroIndicators?.fx_asof ? (
          <p className="mb-2 text-[10px] text-slate-500">FX as of {macroIndicators.fx_asof}</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {(macroIndicators?.bars || []).map((item) => (
            <MacroPill key={item.name} item={item} />
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-slate-700 pt-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Risk Snapshot</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1">
            <p className="text-slate-400">Geo Tension</p>
            <p className="font-semibold text-slate-100">{risks.geopolitical_tension_index}</p>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1">
            <p className="text-slate-400">Macro Stress</p>
            <p className="font-semibold text-slate-100">{risks.market_stress_index}</p>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1">
            <p className="text-slate-400">Anomaly</p>
            <p className="font-semibold text-slate-100">{risks.anomaly_score}</p>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1">
            <p className="text-slate-400">Composite Risk</p>
            <p className="font-semibold text-slate-100">{risks.risk_score}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
