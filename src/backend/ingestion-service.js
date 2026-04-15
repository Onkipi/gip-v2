import { fetchNewsEvents } from "./providers/news-provider.js";
import { config } from "./config.js";

export const ingestLiveEvents = async () => {
  const [newsResult] = await Promise.allSettled([fetchNewsEvents()]);

  const newsEvents = newsResult.status === "fulfilled" ? newsResult.value : [];

  const allEvents = [...newsEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, config.ingestEventCap);

  const deduped = [];
  const seen = new Set();

  for (const event of allEvents) {
    const key = event.id || `${event.headline}:${event.source}:${event.timestamp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }

  return deduped;
};
