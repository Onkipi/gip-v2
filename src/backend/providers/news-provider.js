import { normalizeEvent } from "../normalize.js";
import { hashString, randomBetween, toIso } from "../utils.js";
import { config } from "../config.js";

const FALLBACK_NEWS = [
  "G20 leaders reopen emergency trade de-escalation talks",
  "Major cyber intrusion reported across transnational logistics firms",
  "Unexpected ceasefire proposal introduced in a long-running border conflict",
  "Central bank coalition signals coordinated liquidity support",
  "Energy corridor disruptions raise concerns over global shipping routes",
  "Regional elections produce fragmented mandate and coalition uncertainty",
  "Strategic commodity exporters meet to discuss coordinated output policy",
  "Emergency climate summit discusses rapid food security response"
];

const NEWS_SEEN_TTL_MS = 1000 * 60 * 60 * 8;
const MAX_NEWS_CACHE = 7000;

const newsSeenCache = globalThis.__INTEL_NEWS_SEEN_CACHE__ || new Map();
if (!globalThis.__INTEL_NEWS_SEEN_CACHE__) {
  globalThis.__INTEL_NEWS_SEEN_CACHE__ = newsSeenCache;
}

const timeoutFetch = async (url, options = {}, timeoutMs = config.sourceFetchTimeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 IntelDashboard/1.0",
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const decodeEntities = (input = "") =>
  input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();

const extractTag = (block, tagName) => {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(pattern);
  return decodeEntities(match?.[1] || "");
};

const parseRssItems = (xml, sourceName) => {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return items.map((item) => ({
    title: extractTag(item, "title"),
    summary: extractTag(item, "description"),
    url: extractTag(item, "link"),
    publishedAt: extractTag(item, "pubDate") || Date.now(),
    source: { name: sourceName }
  }));
};

const parseAtomEntries = (xml, sourceName) => {
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return entries.map((entry) => {
    const linkMatch = entry.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
    return {
      title: extractTag(entry, "title"),
      summary: extractTag(entry, "summary") || extractTag(entry, "content"),
      url: decodeEntities(linkMatch?.[1] || ""),
      publishedAt: extractTag(entry, "updated") || extractTag(entry, "published") || Date.now(),
      source: { name: sourceName }
    };
  });
};

const parseCsv = (value = "") =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const googleNewsRss = (query) => {
  const language = config.sourceGoogleLanguage || "en";
  const region = config.sourceGoogleRegion || "US";
  const hl = `${language}-${region}`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${region}&ceid=${region}:${language}`;
};

const toDescriptor = (input, defaults) => {
  if (!input) return null;

  let name = defaults.name;
  let url = input;

  if (input.includes("|")) {
    const [rawName, ...rest] = input.split("|");
    const joined = rest.join("|").trim();
    if (rawName?.trim()) name = rawName.trim();
    if (joined) url = joined;
  }

  try {
    const parsed = new URL(url);
    return {
      name: name || parsed.hostname.replace(/^www\./, ""),
      url: parsed.toString(),
      layer: defaults.layer,
      tier: defaults.tier,
      verification: defaults.verification,
      trustScore: defaults.trustScore,
      categoryHint: defaults.categoryHint || "geopolitics"
    };
  } catch {
    return null;
  }
};

const withDefaults = (items, defaults) =>
  items
    .map((item) => toDescriptor(item, defaults))
    .filter(Boolean);

const dedupeDescriptors = (descriptors) => {
  const seen = new Set();
  const result = [];
  for (const descriptor of descriptors) {
    const key = `${descriptor.name}|${descriptor.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(descriptor);
  }
  return result;
};

const DEFAULT_CORE_FEEDS = [
  `Reuters|${googleNewsRss("site:reuters.com geopolitics OR conflict OR military")}`,
  `Associated Press|${googleNewsRss("site:apnews.com geopolitics OR war OR military")}`,
  "BBC News|http://feeds.bbci.co.uk/news/world/rss.xml",
  "Al Jazeera|https://www.aljazeera.com/xml/rss/all.xml",
  "The New York Times|https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
];

const DEFAULT_OSINT_FEEDS = [
  "Bellingcat|https://www.bellingcat.com/feed/",
  "Oryx|https://www.oryxspioenkop.com/feeds/posts/default?alt=rss",
  `Faytuks Network|${googleNewsRss("Faytuks Network war updates")}`,
  `DeepStateMap.Live|${googleNewsRss("DeepStateMap frontline updates")}`
];

const DEFAULT_FLIGHT_FEEDS = [
  `Flightradar24|${googleNewsRss("Flightradar24 military flight tracking")}`,
  `RadarBox|${googleNewsRss("RadarBox military aircraft")}`,
  `ADS-B Exchange|${googleNewsRss("ADS-B Exchange military flights")}`
];

const DEFAULT_NAVAL_FEEDS = [
  `MarineTraffic|${googleNewsRss("MarineTraffic naval deployment")}`,
  `VesselFinder|${googleNewsRss("VesselFinder warship tanker movement")}`
];

const DEFAULT_YOUTUBE_FEEDS = [
  `NEMICO Network|${googleNewsRss("NEMICO Network YouTube war dashboard")}`,
  `Intel Bird|${googleNewsRss("Intel Bird YouTube military aircraft")}`,
  `Truthdriven|${googleNewsRss("Truthdriven YouTube flight data")}`,
  `Denys Davydov|${googleNewsRss("Denys Davydov YouTube war update")}`
];

const DEFAULT_X_FEEDS = [
  `Aurora Intel|${googleNewsRss('"Aurora Intel" conflict update')}`,
  `GeoConfirmed|${googleNewsRss('"GeoConfirmed" geolocation')}`,
  `IntelSky|${googleNewsRss('"IntelSky" war update')}`,
  `Basha Report|${googleNewsRss('"Basha Report" geopolitics')}`
];

const DEFAULT_REDDIT_FEEDS = [
  "r/geopolitics|https://www.reddit.com/r/geopolitics/new/.rss",
  "r/war|https://www.reddit.com/r/war/new/.rss",
  "r/CombatFootage|https://www.reddit.com/r/CombatFootage/new/.rss",
  "r/UkrainianConflict|https://www.reddit.com/r/UkrainianConflict/new/.rss"
];

const DEFAULT_SATELLITE_FEEDS = [
  `Maxar Technologies|${googleNewsRss("Maxar satellite imagery military")}`,
  `Planet Labs|${googleNewsRss("Planet Labs satellite defense activity")}`,
  `Google Earth|${googleNewsRss("Google Earth conflict mapping")}`
];

const createFeedRegistry = () => {
  const descriptors = [];

  if (config.enableDefaultSourceFeeds) {
    descriptors.push(
      ...withDefaults(DEFAULT_CORE_FEEDS, {
        layer: "core_news",
        tier: "tier-1",
        verification: "verified_media",
        trustScore: 0.95,
        categoryHint: "geopolitics"
      }),
      ...withDefaults(DEFAULT_OSINT_FEEDS, {
        layer: "osint_war",
        tier: "tier-2",
        verification: "osint_crosscheck",
        trustScore: 0.78,
        categoryHint: "geopolitics"
      }),
      ...withDefaults(DEFAULT_FLIGHT_FEEDS, {
        layer: "radar_air",
        tier: "tier-2",
        verification: "signal_only",
        trustScore: 0.74,
        categoryHint: "geopolitics"
      }),
      ...withDefaults(DEFAULT_NAVAL_FEEDS, {
        layer: "radar_naval",
        tier: "tier-2",
        verification: "signal_only",
        trustScore: 0.74,
        categoryHint: "energy"
      }),
      ...withDefaults(DEFAULT_YOUTUBE_FEEDS, {
        layer: "osint_video",
        tier: "tier-3",
        verification: "needs_crosscheck",
        trustScore: 0.62,
        categoryHint: "geopolitics"
      }),
      ...withDefaults(DEFAULT_X_FEEDS, {
        layer: "social_x",
        tier: "tier-3",
        verification: "high_misinformation_risk",
        trustScore: 0.56,
        categoryHint: "geopolitics"
      }),
      ...withDefaults(DEFAULT_REDDIT_FEEDS, {
        layer: "social_reddit",
        tier: "tier-3",
        verification: "crowd_intel",
        trustScore: 0.48,
        categoryHint: "geopolitics"
      }),
      ...withDefaults(DEFAULT_SATELLITE_FEEDS, {
        layer: "satellite",
        tier: "tier-2",
        verification: "osint_crosscheck",
        trustScore: 0.7,
        categoryHint: "geopolitics"
      })
    );
  }

  descriptors.push(
    ...withDefaults(config.newsRssFeeds, {
      layer: "core_news",
      tier: "tier-1",
      verification: "verified_media",
      trustScore: 0.9,
      categoryHint: "geopolitics"
    }),
    ...withDefaults(parseCsv(config.coreNewsFeeds), {
      layer: "core_news",
      tier: "tier-1",
      verification: "verified_media",
      trustScore: 0.95,
      categoryHint: "geopolitics"
    }),
    ...withDefaults(parseCsv(config.osintFeeds), {
      layer: "osint_war",
      tier: "tier-2",
      verification: "osint_crosscheck",
      trustScore: 0.78,
      categoryHint: "geopolitics"
    }),
    ...withDefaults(parseCsv(config.flightFeeds), {
      layer: "radar_air",
      tier: "tier-2",
      verification: "signal_only",
      trustScore: 0.72,
      categoryHint: "geopolitics"
    }),
    ...withDefaults(parseCsv(config.navalFeeds), {
      layer: "radar_naval",
      tier: "tier-2",
      verification: "signal_only",
      trustScore: 0.72,
      categoryHint: "energy"
    }),
    ...withDefaults(parseCsv(config.socialXFeeds), {
      layer: "social_x",
      tier: "tier-3",
      verification: "high_misinformation_risk",
      trustScore: 0.56,
      categoryHint: "geopolitics"
    }),
    ...withDefaults(parseCsv(config.youtubeFeeds), {
      layer: "osint_video",
      tier: "tier-3",
      verification: "needs_crosscheck",
      trustScore: 0.6,
      categoryHint: "geopolitics"
    }),
    ...withDefaults(parseCsv(config.redditFeeds), {
      layer: "social_reddit",
      tier: "tier-3",
      verification: "crowd_intel",
      trustScore: 0.48,
      categoryHint: "geopolitics"
    }),
    ...withDefaults(parseCsv(config.satelliteFeeds), {
      layer: "satellite",
      tier: "tier-2",
      verification: "osint_crosscheck",
      trustScore: 0.7,
      categoryHint: "geopolitics"
    })
  );

  return dedupeDescriptors(descriptors);
};

const createFallbackEvents = () => {
  const now = Date.now();
  const bucket = new Date(now).toISOString().slice(0, 13);
  return Array.from({ length: 6 }).map((_, idx) => {
    const title = FALLBACK_NEWS[Math.floor(Math.random() * FALLBACK_NEWS.length)];
    return normalizeEvent({
      external_id: `fallback_${hashString(`${title}:${bucket}:${idx}`)}`,
      title,
      summary: "Fallback synthetic event generated because external feeds were unavailable.",
      timestamp: toIso(now - idx * 32000),
      baseImpact: randomBetween(40, 84),
      sentiment: randomBetween(-0.75, 0.4),
      source: "news-fallback",
      metadata: {
        layer: "fallback",
        tier: "tier-4",
        verification: "synthetic",
        trust_score: 0.1
      }
    });
  });
};

const articlePublishedMs = (article) => new Date(article.publishedAt || article.timestamp || Date.now()).getTime();

const isRecentArticle = (article) => {
  const publishedMs = articlePublishedMs(article);
  if (!Number.isFinite(publishedMs)) return false;
  const maxAgeMs = 1000 * 60 * 60 * Math.max(1, config.sourceMaxAgeHours);
  return Date.now() - publishedMs <= maxAgeMs;
};

const cleanSeenCache = () => {
  const now = Date.now();
  for (const [key, seenAt] of newsSeenCache.entries()) {
    if (now - seenAt > NEWS_SEEN_TTL_MS) {
      newsSeenCache.delete(key);
    }
  }

  if (newsSeenCache.size > MAX_NEWS_CACHE) {
    const sorted = [...newsSeenCache.entries()].sort((a, b) => a[1] - b[1]);
    const extra = sorted.slice(0, newsSeenCache.size - MAX_NEWS_CACHE);
    for (const [key] of extra) {
      newsSeenCache.delete(key);
    }
  }
};

const makeArticleKey = (article) => {
  const source = article.source?.name || article.source || "news";
  const url = article.url || "";
  const title = article.title || "";
  const publishedAt = article.publishedAt || article.timestamp || "";
  return hashString(`${source}|${url}|${title}|${publishedAt}`);
};

const headlineFingerprint = (headline = "") =>
  hashString(
    headline
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

const mapArticleToEvent = (article, descriptor = {}) => {
  const articleKey = makeArticleKey(article);
  const sourceName = descriptor.name || article.source?.name || article.source || "news";
  return normalizeEvent({
    external_id: `news_${articleKey}`,
    title: article.title,
    summary: article.description || article.content || article.summary || "",
    timestamp: article.publishedAt || Date.now(),
    source: sourceName,
    category: descriptor.categoryHint || "geopolitics",
    url: article.url,
    baseImpact: randomBetween(42, 80),
    metadata: {
      ...(article.metadata || {}),
      layer: descriptor.layer || "news",
      tier: descriptor.tier || "tier-2",
      verification: descriptor.verification || "unknown",
      trust_score: Number.isFinite(descriptor.trustScore) ? descriptor.trustScore : 0.65,
      feed_url: descriptor.url || article.feedUrl || ""
    }
  });
};

const fetchNewsApiEvents = async () => {
  if (!config.newsApiKey) return [];

  const encodedLanguage = encodeURIComponent(config.newsLanguage);
  const endpoints = [
    `https://newsapi.org/v2/top-headlines?language=${encodedLanguage}&pageSize=40&apiKey=${config.newsApiKey}`,
    `https://newsapi.org/v2/everything?q=geopolitics%20OR%20war%20OR%20military%20OR%20sanctions%20OR%20airspace%20OR%20oil&language=${encodedLanguage}&sortBy=publishedAt&pageSize=50&apiKey=${config.newsApiKey}`
  ];

  const settled = await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      const response = await timeoutFetch(endpoint);
      if (!response.ok) {
        throw new Error(`NewsAPI request failed (${response.status})`);
      }
      const payload = await response.json();
      return Array.isArray(payload.articles) ? payload.articles : [];
    })
  );

  return settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((article) => article?.title)
    .filter(isRecentArticle)
    .slice(0, 60)
    .map((article) =>
      mapArticleToEvent(article, {
        name: article.source?.name || "NewsAPI",
        layer: "news_api",
        tier: "tier-1",
        verification: "verified_media",
        trustScore: 0.9,
        categoryHint: "geopolitics"
      })
    );
};

const fetchGdeltEvents = async () => {
  if (!config.enableGdelt) return [];

  const endpoint =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(config.gdeltQuery)}` +
    `&mode=ArtList&format=json&maxrecords=${Math.max(1, config.gdeltMaxRecords)}&sort=HybridRel`;

  const response = await timeoutFetch(endpoint, {}, config.sourceFetchTimeoutMs + 2000);
  if (!response.ok) {
    throw new Error(`GDELT request failed (${response.status})`);
  }

  const payload = await response.json();
  const articles = Array.isArray(payload?.articles) ? payload.articles : [];

  return articles
    .filter((article) => article?.title)
    .map((article) =>
      mapArticleToEvent(
        {
          title: article.title,
          summary: article.seendate ? `GDELT seendate: ${article.seendate}` : "GDELT indexed geopolitical signal",
          url: article.url,
          publishedAt: article.seendate || Date.now(),
          source: { name: article.domain || "GDELT" },
          metadata: {
            sourcecountry: article.sourcecountry || ""
          }
        },
        {
          name: article.domain || "GDELT",
          layer: "osint_aggregate",
          tier: "tier-2",
          verification: "aggregated_open_data",
          trustScore: 0.72,
          categoryHint: "geopolitics",
          url: endpoint
        }
      )
    )
    .filter(isRecentArticle)
    .slice(0, 40);
};

const fetchRssFeedEvents = async (descriptor) => {
  const response = await timeoutFetch(descriptor.url, {}, config.sourceFetchTimeoutMs);
  if (!response.ok) {
    throw new Error(`RSS request failed (${response.status}) for ${descriptor.name}`);
  }

  const xml = await response.text();
  const articles = [...parseRssItems(xml, descriptor.name), ...parseAtomEntries(xml, descriptor.name)];

  return articles
    .filter((article) => article?.title)
    .filter(isRecentArticle)
    .slice(0, config.sourcePerFeedCap)
    .map((article) => mapArticleToEvent(article, descriptor));
};

const fetchConfiguredRssEvents = async () => {
  const feeds = createFeedRegistry();
  if (!feeds.length) return [];

  const settled = await Promise.allSettled(feeds.map((descriptor) => fetchRssFeedEvents(descriptor)));
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
};

const fetchCustomJsonSignalEvents = async () => {
  const feeds = withDefaults(parseCsv(config.customSignalJsonFeeds), {
    layer: "custom_json",
    tier: "tier-2",
    verification: "external_json",
    trustScore: 0.7,
    categoryHint: "geopolitics",
    name: "Custom JSON Feed"
  });

  if (!feeds.length) return [];

  const settled = await Promise.allSettled(
    feeds.map(async (descriptor) => {
      const response = await timeoutFetch(descriptor.url, {
        headers: {
          Accept: "application/json"
        }
      });
      if (!response.ok) {
        throw new Error(`JSON signal request failed (${response.status})`);
      }

      const payload = await response.json();
      const entries = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.events)
          ? payload.events
          : Array.isArray(payload?.articles)
            ? payload.articles
            : [];

      return entries
        .map((entry) =>
          mapArticleToEvent(
            {
              title: entry.title || entry.headline || entry.name,
              summary: entry.summary || entry.description || "",
              url: entry.url || entry.link || "",
              publishedAt: entry.timestamp || entry.publishedAt || entry.datetime || Date.now(),
              source: { name: entry.source || descriptor.name },
              metadata: {
                raw_type: entry.type || ""
              }
            },
            descriptor
          )
        )
        .filter((entry) => entry.headline)
        .filter(isRecentArticle)
        .slice(0, config.sourcePerFeedCap);
    })
  );

  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
};

export const fetchNewsEvents = async () => {
  cleanSeenCache();

  const [apiEvents, rssEvents, gdeltEvents, customJsonEvents] = await Promise.all([
    fetchNewsApiEvents().catch(() => []),
    fetchConfiguredRssEvents().catch(() => []),
    fetchGdeltEvents().catch(() => []),
    fetchCustomJsonSignalEvents().catch(() => [])
  ]);

  const merged = [...apiEvents, ...rssEvents, ...gdeltEvents, ...customJsonEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 360);

  const deduped = [];
  const seen = new Set();
  const seenHeadlines = new Set();
  const now = Date.now();

  for (const event of merged) {
    const key = event.id || hashString(`${event.headline}:${event.source}:${event.timestamp}`);
    if (seen.has(key) || newsSeenCache.has(key)) continue;

    const fingerprint = headlineFingerprint(event.headline);
    if (seenHeadlines.has(fingerprint)) continue;

    seen.add(key);
    seenHeadlines.add(fingerprint);
    newsSeenCache.set(key, now);
    deduped.push(event);

    if (deduped.length >= Math.max(1, config.sourceEmitCap)) break;
  }

  if (deduped.length) return deduped;

  if (merged.length) return [];

  if (toBoolean(process.env.ENABLE_SYNTHETIC_FALLBACK, true)) {
    return createFallbackEvents();
  }

  return [];
};
