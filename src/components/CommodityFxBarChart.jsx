import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from "recharts";

const colorMap = {
  commodity: "#0ea5e9",
  currency: "#0f766e"
};

export const CommodityFxBarChart = ({ macroIndicators }) => {
  const bars = macroIndicators?.bars || [];
  const chartData = bars.map((item) => ({
    name: item.name,
    value: Number(item.value),
    unit: item.unit,
    changePct: Number(item.changePct || 0),
    category: item.category
  }));

  return (
    <section className="rounded-2xl border border-slate-300/60 bg-white/85 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Live Commodities & FX</h3>
          <p className="text-xs text-slate-500">Crude Oil, Food proxy, INR/USD/AED rates updated live</p>
        </div>
        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-medium text-cyan-700">
          {macroIndicators?.source || "feed"}
        </span>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 8, bottom: 18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
            <XAxis dataKey="name" stroke="#64748b" angle={-12} textAnchor="end" interval={0} height={56} />
            <YAxis stroke="#64748b" />
            <Tooltip
              formatter={(value, _, payload) => [`${value} ${payload.payload.unit}`, "Value"]}
              labelFormatter={(label) => `${label}`}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={colorMap[entry.category] || "#0369a1"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {chartData.map((item) => (
          <div key={`${item.name}_meta`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-medium text-slate-700">{item.name}</p>
            <p className="text-xs text-slate-500">
              {item.changePct >= 0 ? "+" : ""}
              {item.changePct.toFixed(3)}% since last cycle
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
