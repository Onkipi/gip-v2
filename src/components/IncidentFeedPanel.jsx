"use client";

import { formatEventAge, formatEventTime, getPriorityLevel, priorityStyles } from "@/lib/event-utils";

const ImpactBar = ({ score }) => {
  const width = Math.max(4, Math.min(100, Number(score || 0)));
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-sky-500" style={{ width: `${width}%` }} />
    </div>
  );
};

export const IncidentFeedPanel = ({
  events,
  selectedEventId,
  onSelectEvent,
  searchQuery,
  onSearchChange,
  selectedRegion,
  onRegionChange,
  selectedCategory,
  onCategoryChange,
  hoursWindow,
  onHoursWindowChange,
  enabledPriorities,
  onPriorityToggle,
  regionOptions,
  categoryOptions,
  paused,
  onPauseToggle
}) => {
  return (
    <aside className="flex h-full flex-col rounded-2xl border border-slate-600/50 bg-slate-900/95 p-3 text-slate-100 shadow-2xl">
      <div className="mb-3 space-y-2 border-b border-slate-700 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Live Feed</h2>
          <button
            type="button"
            onClick={onPauseToggle}
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
              paused ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {paused ? "Paused" : "Live"}
          </button>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search region, headline, keyword..."
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
        />

        <div className="grid grid-cols-2 gap-2">
          <select
            value={selectedRegion}
            onChange={(event) => onRegionChange(event.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            <option value="all">All Regions</option>
            {regionOptions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Timeline Window</span>
            <span>Last {hoursWindow}h</span>
          </div>
          <input
            type="range"
            min={1}
            max={72}
            value={hoursWindow}
            onChange={(event) => onHoursWindowChange(Number(event.target.value))}
            className="w-full accent-sky-500"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(priorityStyles).map(([key, style]) => {
            const active = enabledPriorities[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPriorityToggle(key)}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  active ? `${style.badge} border-transparent` : "border-slate-600 text-slate-300"
                }`}
              >
                {style.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>{events.length} incidents</span>
        <span>Newest first</span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {events.map((event) => {
          const level = getPriorityLevel(event);
          const style = priorityStyles[level];
          const selected = event.id === selectedEventId;

          return (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelectEvent(event.id)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                selected
                  ? "border-sky-500 bg-slate-800"
                  : `${style.border} bg-slate-900 hover:bg-slate-800`
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  {event.location_label || event.region} • {formatEventAge(event.timestamp)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>
                  {style.label}
                </span>
              </div>

              <p className="line-clamp-2 text-sm font-semibold text-slate-100">{event.headline}</p>
              {event.summary ? (
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{event.summary}</p>
              ) : null}

              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate pr-2">{event.source || event.category}</span>
                  <span>{formatEventTime(event.timestamp)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{event.category}</span>
                  <span className="uppercase tracking-[0.12em]">{event.metadata?.tier || "tier-2"}</span>
                </div>
                <ImpactBar score={event.impact_score} />
              </div>
            </button>
          );
        })}

        {!events.length ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm text-slate-400">
            No incidents match the current filters.
          </div>
        ) : null}
      </div>
    </aside>
  );
};
