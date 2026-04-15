import { EventEmitter } from "events";
import Redis from "ioredis";
import { config } from "./config.js";
import { safeJsonParse } from "./utils.js";

const localBus = globalThis.__INTEL_LOCAL_BUS__ || new EventEmitter();
if (!globalThis.__INTEL_LOCAL_BUS__) {
  globalThis.__INTEL_LOCAL_BUS__ = localBus;
}

class RedisLayer {
  constructor() {
    this.pub = null;
    this.sub = null;
    this.cache = null;
    this.ready = false;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    if (!config.redisUrl) {
      this.ready = false;
      return;
    }

    try {
      const redisOpts = {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        ...(config.redisUrl.startsWith("rediss://") ? { tls: { rejectUnauthorized: false } } : {})
      };
      this.pub = new Redis(config.redisUrl, redisOpts);
      this.sub = new Redis(config.redisUrl, redisOpts);
      this.cache = new Redis(config.redisUrl, redisOpts);

      await Promise.all([this.pub.connect(), this.sub.connect(), this.cache.connect()]);
      await this.sub.subscribe(config.redisChannel);

      this.sub.on("message", (_, message) => {
        const parsed = safeJsonParse(message, null);
        if (!parsed) return;
        localBus.emit("intel:update", parsed);
      });

      this.ready = true;
    } catch {
      this.ready = false;
    }
  }

  isReady() {
    return this.ready;
  }

  async publish(topic, payload, origin) {
    const envelope = {
      topic,
      payload,
      origin,
      timestamp: new Date().toISOString()
    };

    localBus.emit("intel:update", envelope);

    if (!this.ready || !this.pub) return;

    try {
      await this.pub.publish(config.redisChannel, JSON.stringify(envelope));
    } catch {
      this.ready = false;
    }
  }

  subscribe(handler) {
    const wrapped = (message) => {
      handler(message);
    };

    localBus.on("intel:update", wrapped);

    return () => {
      localBus.off("intel:update", wrapped);
    };
  }

  async pushEvent(event) {
    if (!this.ready || !this.cache) return;
    try {
      await this.cache
        .multi()
        .lpush(config.redisHistoryKey, JSON.stringify(event))
        .ltrim(config.redisHistoryKey, 0, config.historyLimit - 1)
        .exec();
    } catch {
      this.ready = false;
    }
  }

  async getRecentEvents(limit = config.historyLimit) {
    if (!this.ready || !this.cache) {
      return [];
    }

    try {
      const rows = await this.cache.lrange(config.redisHistoryKey, 0, Math.max(limit - 1, 0));
      return rows.map((row) => safeJsonParse(row, null)).filter(Boolean);
    } catch {
      this.ready = false;
      return [];
    }
  }

  async shutdown() {
    const clients = [this.pub, this.sub, this.cache].filter(Boolean);
    await Promise.all(clients.map((client) => client.quit().catch(() => null)));
    this.ready = false;
  }
}

const singleton = globalThis.__INTEL_REDIS_LAYER__ || new RedisLayer();
if (!globalThis.__INTEL_REDIS_LAYER__) {
  globalThis.__INTEL_REDIS_LAYER__ = singleton;
}

export const redisLayer = singleton;
