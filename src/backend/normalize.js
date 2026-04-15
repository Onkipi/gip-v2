import { clamp, hashString, makeId, toIso } from "./utils.js";

const POSITIVE_WORDS = ["progress", "deal", "growth", "recover", "easing", "stabilize", "agreement", "surge"];
const NEGATIVE_WORDS = ["conflict", "sanction", "attack", "crisis", "shock", "selloff", "collapse", "warning"];

const REGION_RULES = [
  { region: "North America", pattern: /(united states|canada|mexico|washington|new york|ottawa)/i },
  { region: "Europe", pattern: /(europe|eu|uk|germany|france|brussels|nato)/i },
  { region: "Middle East", pattern: /(middle east|iran|israel|saudi|gulf|qatar|turkey)/i },
  { region: "Asia-Pacific", pattern: /(china|japan|india|pacific|korea|taiwan|singapore)/i },
  { region: "Africa", pattern: /(africa|nigeria|ethiopia|kenya|south africa|sudan)/i },
  { region: "Latin America", pattern: /(latin america|brazil|argentina|chile|colombia|peru)/i }
];

const REGION_COORDINATES = {
  "North America": { lat: 39.5, lng: -98.35, label: "North America" },
  Europe: { lat: 50.11, lng: 8.68, label: "Europe" },
  "Middle East": { lat: 31.95, lng: 35.93, label: "Middle East" },
  "Asia-Pacific": { lat: 22.28, lng: 114.16, label: "Asia-Pacific" },
  Africa: { lat: 1.29, lng: 36.82, label: "Africa" },
  "Latin America": { lat: -15.79, lng: -47.88, label: "Latin America" },
  Global: { lat: 20, lng: 0, label: "Global" }
};

const LOCATION_RULES = [
  { label: "Kyiv", lat: 50.4501, lng: 30.5234, pattern: /(kyiv|kiev|ukraine)/i },
  { label: "Moscow", lat: 55.7558, lng: 37.6173, pattern: /(moscow|russia|kremlin)/i },
  { label: "Tehran", lat: 35.6892, lng: 51.389, pattern: /(tehran|iran)/i },
  { label: "Tel Aviv", lat: 32.0853, lng: 34.7818, pattern: /(tel aviv|israel|gaza)/i },
  { label: "Riyadh", lat: 24.7136, lng: 46.6753, pattern: /(riyadh|saudi)/i },
  { label: "Ankara", lat: 39.9334, lng: 32.8597, pattern: /(ankara|turkey)/i },
  { label: "Beijing", lat: 39.9042, lng: 116.4074, pattern: /(beijing|china)/i },
  { label: "Tokyo", lat: 35.6762, lng: 139.6503, pattern: /(tokyo|japan)/i },
  { label: "New Delhi", lat: 28.6139, lng: 77.209, pattern: /(india|new delhi|delhi)/i },
  { label: "Washington DC", lat: 38.9072, lng: -77.0369, pattern: /(washington|united states|u\.s\.)/i },
  { label: "London", lat: 51.5072, lng: -0.1276, pattern: /(london|uk|britain)/i },
  { label: "Paris", lat: 48.8566, lng: 2.3522, pattern: /(paris|france)/i },
  { label: "Berlin", lat: 52.52, lng: 13.405, pattern: /(berlin|germany)/i },
  { label: "Brussels", lat: 50.8503, lng: 4.3517, pattern: /(brussels|eu|nato)/i },
  { label: "Cairo", lat: 30.0444, lng: 31.2357, pattern: /(cairo|egypt)/i },
  { label: "Nairobi", lat: -1.2864, lng: 36.8172, pattern: /(nairobi|kenya)/i },
  { label: "Lagos", lat: 6.5244, lng: 3.3792, pattern: /(lagos|nigeria)/i },
  { label: "Sao Paulo", lat: -23.5505, lng: -46.6333, pattern: /(brazil|sao paulo)/i },
  { label: "Mexico City", lat: 19.4326, lng: -99.1332, pattern: /(mexico|mexico city)/i }
];

const CATEGORY_RULES = [
  { category: "geopolitics", pattern: /(election|border|military|diplomacy|sanction|government|security)/i },
  { category: "market", pattern: /(stock|bond|market|yield|index|currency|equity|fed|inflation)/i },
  { category: "energy", pattern: /(oil|gas|energy|opec|pipeline|power|electricity)/i },
  { category: "technology", pattern: /(ai|technology|semiconductor|chip|cyber|cloud)/i }
];

const scoreSentiment = (text = "") => {
  const normalized = text.toLowerCase();
  let score = 0;

  for (const word of POSITIVE_WORDS) {
    if (normalized.includes(word)) score += 1;
  }
  for (const word of NEGATIVE_WORDS) {
    if (normalized.includes(word)) score -= 1;
  }

  if (!score) return 0;
  return clamp(score / 4, -1, 1);
};

const inferRegion = (text = "") => {
  const match = REGION_RULES.find((rule) => rule.pattern.test(text));
  return match?.region || "Global";
};

const inferCategory = (text = "", fallback = "geopolitics") => {
  const match = CATEGORY_RULES.find((rule) => rule.pattern.test(text));
  return match?.category || fallback;
};

const deriveImpact = ({ text, baseImpact = 52, sentiment = 0 }) => {
  const negativeBoost = sentiment < 0 ? Math.abs(sentiment) * 22 : 0;
  const uncertaintyBoost = /(urgent|emergency|warning|missile|default|bank run|blackout)/i.test(text) ? 18 : 0;
  const stabilizeCut = /(agreement|de-escalation|cooling|ceasefire|recovery)/i.test(text) ? 12 : 0;
  return clamp(baseImpact + negativeBoost + uncertaintyBoost - stabilizeCut, 6, 98);
};

const stringHash = (value = "") => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const applyJitter = ({ lat, lng }, seedText) => {
  const seed = stringHash(seedText);
  const jitterLat = ((seed % 1000) / 1000 - 0.5) * 1.2;
  const jitterLng = (((seed / 7) % 1000) / 1000 - 0.5) * 1.2;
  return {
    lat: clamp(lat + jitterLat, -85, 85),
    lng: clamp(lng + jitterLng, -180, 180)
  };
};

const inferGeo = ({ text, region, rawEvent }) => {
  if (Number.isFinite(rawEvent.latitude) && Number.isFinite(rawEvent.longitude)) {
    return {
      latitude: clamp(rawEvent.latitude, -85, 85),
      longitude: clamp(rawEvent.longitude, -180, 180),
      location_label: rawEvent.location_label || region
    };
  }

  const locationMatch = LOCATION_RULES.find((rule) => rule.pattern.test(text));
  if (locationMatch) {
    const jittered = applyJitter({ lat: locationMatch.lat, lng: locationMatch.lng }, `${text}:${region}`);
    return {
      latitude: Number(jittered.lat.toFixed(5)),
      longitude: Number(jittered.lng.toFixed(5)),
      location_label: locationMatch.label
    };
  }

  const fallback = REGION_COORDINATES[region] || REGION_COORDINATES.Global;
  const jittered = applyJitter({ lat: fallback.lat, lng: fallback.lng }, `${text}:${region}`);
  return {
    latitude: Number(jittered.lat.toFixed(5)),
    longitude: Number(jittered.lng.toFixed(5)),
    location_label: fallback.label
  };
};

export const normalizeEvent = (rawEvent) => {
  const text = `${rawEvent.title || ""} ${rawEvent.summary || ""}`.trim();
  const sentiment = Number.isFinite(rawEvent.sentiment) ? clamp(rawEvent.sentiment, -1, 1) : scoreSentiment(text);
  const category = rawEvent.category || inferCategory(text, "geopolitics");
  const region = rawEvent.region || inferRegion(text);
  const geo = inferGeo({
    text,
    region,
    rawEvent
  });

  const stableIdSeed = rawEvent.external_id || rawEvent.url || `${rawEvent.source || "unknown"}:${rawEvent.title || ""}:${rawEvent.timestamp || ""}`;
  const stableId = `evt_${hashString(stableIdSeed)}`;

  return {
    id: rawEvent.id || (stableIdSeed.trim() ? stableId : makeId("evt")),
    headline: rawEvent.title || "Untitled event",
    summary: rawEvent.summary || "",
    timestamp: rawEvent.timestamp ? toIso(rawEvent.timestamp) : toIso(),
    region,
    ...geo,
    category,
    sentiment,
    impact_score: Number.isFinite(rawEvent.impact_score)
      ? Number(clamp(rawEvent.impact_score, 0, 100).toFixed(2))
      : Number(deriveImpact({ text, baseImpact: rawEvent.baseImpact || 50, sentiment }).toFixed(2)),
    volatility: Number.isFinite(rawEvent.volatility) ? clamp(rawEvent.volatility, 0, 2) : clamp(Math.abs(sentiment) * 1.1 + Math.random() * 0.35, 0.05, 2),
    source: rawEvent.source || "unknown",
    url: rawEvent.url || "",
    metadata: rawEvent.metadata || {}
  };
};
