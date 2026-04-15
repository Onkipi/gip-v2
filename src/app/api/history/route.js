import { snapshotStore } from "@/backend/snapshot";
import { redisLayer } from "@/backend/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normalizeEvents = (events = []) => {
  const seen = new Set();
  const cutoffMs = Date.now() - 1000 * 60 * 60 * 72;
  const prepared = events
    .filter((event) => event && event.category !== "market")
    .filter((event) => new Date(event.timestamp).getTime() >= cutoffMs)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .filter((event) => {
      const key = event.url || event.id || `${event.headline}:${event.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const hasLiveSource = prepared.some((event) => !String(event.source || "").includes("fallback"));
  if (hasLiveSource) {
    return prepared.filter((event) => !String(event.source || "").includes("fallback"));
  }

  return prepared;
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 120);
  const boundedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 120;

  const redisEvents = await redisLayer.getRecentEvents(boundedLimit);
  const fallback = snapshotStore.getEvents(boundedLimit);
  const events = normalizeEvents([...redisEvents, ...fallback]).slice(0, boundedLimit);

  return Response.json({
    events,
    count: events.length,
    source: redisEvents.length ? "redis+memory" : "memory"
  });
}
