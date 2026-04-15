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

export async function GET() {
  const snapshot = snapshotStore.getSnapshot();
  const redisEvents = await redisLayer.getRecentEvents(140);
  const mergedEvents = normalizeEvents([...snapshot.events, ...redisEvents]).slice(0, 140);

  return Response.json({
    ...snapshot,
    events: mergedEvents,
    transport: {
      websocket_path: process.env.NEXT_PUBLIC_SOCKET_PATH || "/socket.io",
      redis_connected: redisLayer.isReady()
    },
    server_time: new Date().toISOString()
  });
}
