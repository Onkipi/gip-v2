const modes = [
  { id: "baseline", label: "Baseline", description: "Standard geopolitical and macro baseline behavior" },
  { id: "crisis", label: "Crisis", description: "Elevated contagion and risk propagation" },
  { id: "extreme", label: "Extreme", description: "Shock-mode with aggressive stress weighting" }
];

export const ScenarioModeToggle = ({ scenario, onChange }) => {
  return (
    <section className="rounded-2xl border border-slate-300/60 bg-white/85 p-4 shadow-sm backdrop-blur">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Scenario Mode</h3>
      <div className="grid gap-2 md:grid-cols-3">
        {modes.map((mode) => {
          const isActive = mode.id === scenario;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={`rounded-xl border px-3 py-2 text-left transition ${
                isActive
                  ? "border-sky-500 bg-sky-50 text-sky-800"
                  : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50/40"
              }`}
            >
              <p className="text-sm font-semibold">{mode.label}</p>
              <p className="mt-1 text-xs">{mode.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
};
