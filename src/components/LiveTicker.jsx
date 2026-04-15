const priorityConfig = {
  high: {
    label: "High",
    badge: "bg-red-100 text-red-700",
    border: "border-red-300"
  },
  medium: {
    label: "Medium",
    badge: "bg-amber-100 text-amber-700",
    border: "border-amber-300"
  },
  normal: {
    label: "Normal",
    badge: "bg-emerald-100 text-emerald-700",
    border: "border-emerald-300"
  }
};

const getPriority = (event) => {
  const impact = Number(event?.impact_score || 0);
  const sentiment = Number(event?.sentiment || 0);

  if (impact >= 75 || sentiment <= -0.45) return "high";
  if (impact >= 52 || sentiment <= -0.2) return "medium";
  return "normal";
};

const summarize = (text = "", maxChars = 120) => {
  if (!text) return "";
  return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;
};

const formatTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const LiveTicker = ({ events }) => {
  const feed = events.slice(0, 10);

  if (!feed.length) {
    return (
      <section className="rounded-2xl border border-slate-300/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-sm text-slate-600">Waiting for live events feed...</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-300/60 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Live Feed</h2>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">Red: High</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Amber: Medium</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Green: Normal</span>
        </div>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {feed.map((event) => {
          const priority = getPriority(event);
          const style = priorityConfig[priority];

          return (
            <article key={event.id} className={`rounded-xl border bg-white p-3 ${style.border}`}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {event.region} {formatTime(event.timestamp) ? `• ${formatTime(event.timestamp)}` : ""}
                </p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>{style.label}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800">{event.headline}</p>
              {event.summary ? <p className="mt-1 text-xs text-slate-600">{summarize(event.summary)}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
};
