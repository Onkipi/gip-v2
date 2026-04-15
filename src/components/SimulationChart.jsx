import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, BarChart, Bar } from "recharts";

export const SimulationChart = ({ monteCarlo }) => {
  const data = monteCarlo?.timeseries || [];
  const outcomes = monteCarlo?.outcomeProbabilities || [];

  return (
    <section className="rounded-2xl border border-slate-300/60 bg-white/85 p-4 shadow-sm backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Rolling Monte Carlo</h3>
          <p className="text-xs text-slate-500">{monteCarlo?.iterations || 0} iterations, auto-updated on each feed cycle</p>
        </div>
        <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700">{monteCarlo?.scenario || "baseline"}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="h-72 lg:col-span-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="step" stroke="#64748b" />
              <YAxis stroke="#64748b" domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="stability" stroke="#0f766e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tension" stroke="#0369a1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="crisis" stroke="#b91c1c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="h-72 lg:col-span-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={outcomes} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
              <XAxis type="number" domain={[0, 100]} stroke="#64748b" />
              <YAxis dataKey="name" type="category" stroke="#64748b" width={80} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="value" fill="#0ea5e9" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
