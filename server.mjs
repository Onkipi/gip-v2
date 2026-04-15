import http from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./src/backend/config.js";
import { redisLayer } from "./src/backend/redis.js";
import { snapshotStore } from "./src/backend/snapshot.js";
import { createRealtimeEngine } from "./src/backend/realtime-engine.js";
import { setRealtimeEngine } from "./src/backend/engine-registry.js";

const dev = process.env.NODE_ENV !== "production";
const app = next({
  dev,
  hostname: config.host,
  port: config.port
});

const requestHandler = app.getRequestHandler();

await app.prepare();

const server = http.createServer((req, res) => {
  requestHandler(req, res);
});

const io = new SocketIOServer(server, {
  path: config.socketPath,
  cors: {
    origin: "*"
  }
});

await redisLayer.init();

const engine = createRealtimeEngine({
  io,
  redisLayer,
  snapshotStore
});

setRealtimeEngine(engine);
engine.start();

io.on("connection", (socket) => {
  socket.emit("bootstrap", snapshotStore.getSnapshot());

  socket.on("scenario_set", async (payload) => {
    const requestedScenario = payload?.scenario;
    const success = await engine.setScenario(requestedScenario);

    socket.emit("scenario_ack", {
      success,
      scenario: engine.getScenario(),
      timestamp: new Date().toISOString()
    });
  });
});

server.listen(config.port, config.host, () => {
  const redisState = redisLayer.isReady() ? "connected" : "mock-mode";
  console.log(`${config.appName} listening at http://${config.host}:${config.port} (${redisState})`);
});

const shutdown = async () => {
  await engine.stop();
  await redisLayer.shutdown();
  io.close();
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
