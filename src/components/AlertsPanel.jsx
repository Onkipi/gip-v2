const alertColor = {
  low: "bg-emerald-100 text-emerald-700",
  elevated: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700"
};

export const AlertsPanel = ({ alerts }) => {
  return (
    <section className="rounded-2xl border border-slate-300/60 bg-white/85 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Risk Alerts</h3>
        <span className="text-xs text-slate-500">{alerts.length} active</span>
      </div>

      {alerts.length ? (
        <ul className="space-y-3">
          {alerts.slice(0, 8).map((alert) => (
            <li key={alert.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{alert.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${alertColor[alert.severity] || alertColor.elevated}`}>
                  {alert.severity}
                </span>
              </div>
              <p className="text-xs text-slate-600">{alert.message}</p>
              <p className="mt-2 text-[11px] text-slate-500">{new Date(alert.timestamp).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">No alerts triggered yet.</p>
      )}
    </section>
  );
};
