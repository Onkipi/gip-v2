const heatColor = (impact) => {
  const alpha = Math.min(0.9, Math.max(0.1, impact / 100));
  return `rgba(14, 116, 144, ${alpha})`;
};

export const RegionHeatMap = ({ events }) => {
  const byRegion = events.slice(0, 120).reduce((acc, event) => {
    if (!acc[event.region]) {
      acc[event.region] = {
        region: event.region,
        count: 0,
        impact: 0
      };
    }

    acc[event.region].count += 1;
    acc[event.region].impact += event.impact_score;
    return acc;
  }, {});

  const cells = Object.values(byRegion)
    .map((region) => ({
      ...region,
      avgImpact: region.count ? Number((region.impact / region.count).toFixed(2)) : 0
    }))
    .sort((a, b) => b.avgImpact - a.avgImpact)
    .slice(0, 9);

  return (
    <section className="rounded-2xl border border-slate-300/60 bg-white/85 p-4 shadow-sm backdrop-blur">
      <h3 className="text-sm font-semibold text-slate-800">Region Heat Map</h3>
      <p className="mb-3 text-xs text-slate-500">Event pressure by region from recent ingestion windows</p>

      {cells.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {cells.map((cell) => (
            <article key={cell.region} className="rounded-xl p-3 text-white shadow-sm" style={{ backgroundColor: heatColor(cell.avgImpact) }}>
              <h4 className="text-sm font-semibold">{cell.region}</h4>
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/80">Pressure</p>
              <p className="text-lg font-semibold">{cell.avgImpact}</p>
              <p className="text-xs text-white/80">{cell.count} events</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-600">No regional events yet.</p>
      )}
    </section>
  );
};
