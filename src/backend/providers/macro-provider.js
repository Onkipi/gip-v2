import { config } from "../config.js";
import { clamp } from "../utils.js";

const macroState = globalThis.__INTEL_MACRO_STATE__ || {
  "Crude Oil": 81.4,
  "Food (Wheat)": 6.7,
  USD: 1,
  INR: 83.2,
  AED: 3.67
};

if (!globalThis.__INTEL_MACRO_STATE__) {
  globalThis.__INTEL_MACRO_STATE__ = macroState;
}

const macroCache = globalThis.__INTEL_MACRO_CACHE__ || {
  lastPayload: null,
  lastFetchAt: 0
};

if (!globalThis.__INTEL_MACRO_CACHE__) {
  globalThis.__INTEL_MACRO_CACHE__ = macroCache;
}

const timeoutFetch = async (url, options = {}, timeoutMs = 9000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      headers: {
        "User-Agent": "geo-political-intelligence-system/1.0",
        ...(options.headers || {})
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const saneFxOrThrow = (value, min, max, label) => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Out-of-range FX quote for ${label}: ${value}`);
  }
  return value;
};

const withChange = (name, value, unit, source, category) => {
  const previous = macroState[name];
  macroState[name] = value;

  const changePct = previous
    ? ((value - previous) / (Math.abs(previous) < 1e-6 ? 1 : previous)) * 100
    : 0;

  return {
    name,
    value: Number(value.toFixed(4)),
    unit,
    category,
    changePct: Number(changePct.toFixed(4)),
    source
  };
};

const parseYahooQuote = (rows, symbol) => {
  const row = rows.find((item) => item?.symbol === symbol);
  if (!row) return null;
  const price = toNumber(row.regularMarketPrice, NaN);
  return Number.isFinite(price) ? price : null;
};

const fetchCommoditiesFromYahoo = async () => {
  const endpoint =
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=CL%3DF,ZW%3DF";
  const response = await timeoutFetch(endpoint);
  if (!response.ok) {
    throw new Error(`Yahoo quote request failed (${response.status})`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.quoteResponse?.result)
    ? payload.quoteResponse.result
    : [];

  const crudeOil = parseYahooQuote(rows, "CL=F");
  const wheat = parseYahooQuote(rows, "ZW=F");

  if (![crudeOil, wheat].every((value) => Number.isFinite(value))) {
    throw new Error("Incomplete Yahoo commodity quote payload");
  }

  return {
    crudeOil: clamp(crudeOil, 20, 220),
    wheat: clamp(wheat, 2, 30)
  };
};

const fetchFxFromOpenErApi = async () => {
  const endpoint = "https://open.er-api.com/v6/latest/USD";
  const response = await timeoutFetch(endpoint);
  if (!response.ok) {
    throw new Error(`Open ER API request failed (${response.status})`);
  }

  const payload = await response.json();
  if (payload?.result !== "success" || payload?.base_code !== "USD") {
    throw new Error("Open ER API invalid response");
  }

  const inr = saneFxOrThrow(toNumber(payload?.rates?.INR, NaN), 80, 110, "USD/INR");
  const aed = saneFxOrThrow(toNumber(payload?.rates?.AED, NaN), 3.5, 3.9, "USD/AED");

  return {
    inr,
    aed,
    timestamp: payload?.time_last_update_utc || new Date().toISOString(),
    source: "erapi-fx"
  };
};

const fetchUsdFxRate = async (toCurrency) => {
  if (!config.alphaVantageKey) {
    throw new Error("Alpha Vantage key unavailable");
  }

  const endpoint = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=${toCurrency}&apikey=${config.alphaVantageKey}`;
  const response = await timeoutFetch(endpoint);
  if (!response.ok) {
    throw new Error(`Alpha Vantage FX request failed (${response.status})`);
  }
  const payload = await response.json();
  const quote = payload["Realtime Currency Exchange Rate"];
  if (!quote) {
    throw new Error(`No FX quote for USD/${toCurrency}`);
  }
  return toNumber(quote["5. Exchange Rate"], 0);
};

const fetchCommoditySeries = async (fnName) => {
  if (!config.alphaVantageKey) {
    throw new Error("Alpha Vantage key unavailable");
  }

  const endpoint = `https://www.alphavantage.co/query?function=${fnName}&interval=monthly&apikey=${config.alphaVantageKey}`;
  const response = await timeoutFetch(endpoint);
  if (!response.ok) {
    throw new Error(`Alpha Vantage commodity request failed (${response.status})`);
  }
  const payload = await response.json();
  const rows = Array.isArray(payload.data) ? payload.data : [];
  if (!rows.length || rows[0]?.value === "." || rows[0]?.value == null) {
    throw new Error(`No commodity rows for ${fnName}`);
  }
  return toNumber(rows[0].value, 0);
};

const fetchMacroFromAlphaVantage = async () => {
  const [wti, wheat, inr, aed] = await Promise.all([
    fetchCommoditySeries("WTI"),
    fetchCommoditySeries("WHEAT"),
    fetchUsdFxRate("INR"),
    fetchUsdFxRate("AED")
  ]);

  return {
    crudeOil: clamp(wti, 20, 220),
    wheat: clamp(wheat, 2, 30),
    inr: saneFxOrThrow(clamp(inr, 50, 130), 80, 110, "USD/INR"),
    aed: saneFxOrThrow(clamp(aed, 2, 8), 3.5, 3.9, "USD/AED")
  };
};

const staleFromCache = () => {
  if (macroCache.lastPayload) {
    return {
      ...macroCache.lastPayload,
      stale: true,
      source: `${macroCache.lastPayload.source}-cached`
    };
  }

  return {
    timestamp: new Date().toISOString(),
    source: "bootstrap-cached",
    stale: true,
    bars: [
      withChange("Crude Oil", macroState["Crude Oil"] || 81.4, "USD / bbl", "bootstrap-cached", "commodity"),
      withChange("Food (Wheat)", macroState["Food (Wheat)"] || 6.7, "USD / bushel", "bootstrap-cached", "commodity"),
      withChange("USD", 1, "base", "bootstrap-cached", "currency"),
      withChange("INR", macroState.INR || 83.2, "per USD", "bootstrap-cached", "currency"),
      withChange("AED", macroState.AED || 3.67, "per USD", "bootstrap-cached", "currency")
    ]
  };
};

export const fetchMacroIndicators = async () => {
  const now = Date.now();
  const refreshMs = Math.max(10000, config.macroRefreshMs);

  if (macroCache.lastPayload && now - macroCache.lastFetchAt < refreshMs) {
    return macroCache.lastPayload;
  }

  try {
    const [commodityResult, fxResult] = await Promise.allSettled([
      fetchCommoditiesFromYahoo(),
      fetchFxFromOpenErApi()
    ]);

    if (commodityResult.status !== "fulfilled" || fxResult.status !== "fulfilled") {
      throw new Error("Primary spot feeds unavailable");
    }

    const payload = {
      timestamp: new Date().toISOString(),
      source: "yahoo-spot+erapi-fx",
      stale: false,
      bars: [
        withChange("Crude Oil", commodityResult.value.crudeOil, "USD / bbl", "yahoo-spot", "commodity"),
        withChange("Food (Wheat)", commodityResult.value.wheat, "USD / bushel", "yahoo-spot", "commodity"),
        withChange("USD", 1, "base", "erapi-fx", "currency"),
        withChange("INR", fxResult.value.inr, "per USD", "erapi-fx", "currency"),
        withChange("AED", fxResult.value.aed, "per USD", "erapi-fx", "currency")
      ],
      fx_asof: fxResult.value.timestamp
    };
    macroCache.lastPayload = payload;
    macroCache.lastFetchAt = now;
    return payload;
  } catch {
    try {
      const fallback = await fetchMacroFromAlphaVantage();
      const payload = {
        timestamp: new Date().toISOString(),
        source: "alpha-vantage",
        stale: false,
        bars: [
          withChange("Crude Oil", fallback.crudeOil, "USD / bbl", "alpha-vantage", "commodity"),
          withChange("Food (Wheat)", fallback.wheat, "USD / bushel", "alpha-vantage", "commodity"),
          withChange("USD", 1, "base", "alpha-vantage", "currency"),
          withChange("INR", fallback.inr, "per USD", "alpha-vantage", "currency"),
          withChange("AED", fallback.aed, "per USD", "alpha-vantage", "currency")
        ]
      };
      macroCache.lastPayload = payload;
      macroCache.lastFetchAt = now;
      return payload;
    } catch {
      return staleFromCache();
    }
  }
};
