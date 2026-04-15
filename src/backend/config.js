const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const scenarioMultipliers = {
  baseline: 1,
  crisis: 1.35,
  extreme: 1.8
};

export const config = {
  appName: process.env.APP_NAME || "Real-Time Intelligence System",
  host: process.env.HOST || "0.0.0.0",
  port: toNumber(process.env.PORT, 3000),
  socketPath: process.env.SOCKET_PATH || "/socket.io",
  ingestIntervalMs: toNumber(process.env.INGEST_INTERVAL_MS, 15000),
  ingestEventCap: toNumber(process.env.INGEST_EVENT_CAP, 72),
  monteCarloIterations: toNumber(process.env.MONTE_CARLO_ITERATIONS, 1200),
  maxEvents: toNumber(process.env.MAX_EVENTS, 600),
  redisUrl: process.env.REDIS_URL || "",
  redisChannel: process.env.REDIS_CHANNEL || "intel:stream",
  redisHistoryKey: process.env.REDIS_HISTORY_KEY || "intel:events",
  historyLimit: toNumber(process.env.HISTORY_LIMIT, 250),
  newsApiKey: process.env.NEWS_API_KEY || "",
  alphaVantageKey: process.env.ALPHA_VANTAGE_API_KEY || "",
  newsLanguage: process.env.NEWS_LANGUAGE || "en",
  sourceFetchTimeoutMs: toNumber(process.env.SOURCE_FETCH_TIMEOUT_MS, 9000),
  sourceMaxAgeHours: toNumber(process.env.SOURCE_MAX_AGE_HOURS, 72),
  sourceEmitCap: toNumber(process.env.SOURCE_EMIT_CAP, 36),
  sourcePerFeedCap: toNumber(process.env.SOURCE_PER_FEED_CAP, 20),
  sourceGoogleRegion: process.env.SOURCE_GOOGLE_REGION || "US",
  sourceGoogleLanguage: process.env.SOURCE_GOOGLE_LANGUAGE || "en",
  enableDefaultSourceFeeds: toBoolean(process.env.ENABLE_DEFAULT_SOURCE_FEEDS, true),
  enableGdelt: toBoolean(process.env.ENABLE_GDELT, true),
  gdeltQuery:
    process.env.GDELT_QUERY ||
    "geopolitics OR conflict OR military OR sanctions OR airspace OR naval OR drone OR missile OR border",
  gdeltMaxRecords: toNumber(process.env.GDELT_MAX_RECORDS, 40),
  predictionMonteCarloRuns: toNumber(process.env.PREDICTION_MONTE_CARLO_RUNS, 2400),
  predictionLookbackHours: toNumber(process.env.PREDICTION_LOOKBACK_HOURS, 72),
  coreNewsFeeds: process.env.CORE_NEWS_FEEDS || "",
  osintFeeds: process.env.OSINT_FEEDS || "",
  flightFeeds: process.env.FLIGHT_FEEDS || "",
  navalFeeds: process.env.NAVAL_FEEDS || "",
  socialXFeeds: process.env.SOCIAL_X_FEEDS || "",
  youtubeFeeds: process.env.YOUTUBE_FEEDS || "",
  redditFeeds: process.env.REDDIT_FEEDS || "",
  satelliteFeeds: process.env.SATELLITE_FEEDS || "",
  customSignalJsonFeeds: process.env.CUSTOM_SIGNAL_JSON_FEEDS || "",
  newsRssFeeds: (process.env.NEWS_RSS_FEEDS ||
    "http://feeds.bbci.co.uk/news/world/rss.xml,https://rss.nytimes.com/services/xml/rss/nyt/World.xml,https://www.aljazeera.com/xml/rss/all.xml")
    .split(",")
    .map((feed) => feed.trim())
    .filter(Boolean),
  macroRefreshMs: toNumber(process.env.MACRO_REFRESH_MS, 60000),
  riskAlertThreshold: toNumber(process.env.RISK_ALERT_THRESHOLD, 72),
  riskCooldownMs: toNumber(process.env.RISK_ALERT_COOLDOWN_MS, 120000),
  nextPublicSocketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || "",
  nextPublicSocketPath: process.env.NEXT_PUBLIC_SOCKET_PATH || "/socket.io"
};
