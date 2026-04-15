import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

const gaugeColor = (score) => {
  if (score >= 62) return "#0f766e";
  if (score >= 45) return "#0369a1";
  if (score >= 33) return "#d97706";
  return "#b91c1c";
};

export const SentimentGauge = ({ events }) => {
  const sample = events.slice(0, 50);
  const avgSentiment = sample.length
    ? sample.reduce((sum, event) => sum + event.sentiment, 0) / sample.length
    : 0;

  const score = Math.round(((avgSentiment + 1) / 2) * 100);
  const color = gaugeColor(score);

  return (
    <section className="rounded-2xl border border-slate-300/60 bg-white/85 p-4 shadow-sm backdrop-blur">
      <h3 className="text-sm font-semibold text-slate-800">Sentiment Gauge</h3>
      <p className="mb-3 text-xs text-slate-500">Live average sentiment from latest events</p>

      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="55%"
            innerRadius="55%"
            outerRadius="90%"
            barSize={18}
            data={[{ name: "sentiment", value: score }]}
            startAngle={220}
            endAngle={-40}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} fill={color} />
          </RadialBarChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold" style={{ color }}>
            {score}
          </span>
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Sentiment Index</span>
        </div>
      </div>
    </section>
  );
};
