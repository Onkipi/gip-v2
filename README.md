# Geopolitical Intelligence Platform v2.0

> Real-time geopolitical risk assessment — Bayesian-weighted Monte Carlo predictions, live multi-source ingestion, explainable AI, and interactive scenario simulation.

---

## What's Inside

This repository ships **two independent ways to run the platform**:

| Mode | File | Requires |
|------|------|----------|
| **Standalone Dashboard** | `intelligence-platform.html` | Just a browser |
| **Full-Stack App** | `server.mjs` + `src/` | Node.js 18+, optional Redis |

---

## Standalone HTML Dashboard (Quickstart)

No install. No server. Open one file:

```bash
open intelligence-platform.html
# or serve locally for full live-feed support:
npx serve .
# then open http://localhost:3000/intelligence-platform.html
```

### Dashboard Tabs

| Tab | What it does |
|-----|-------------|
| **Map View** | Live 3-panel layout — Leaflet map, live incident feed, intel panel |
| **Overview** | Risk scores, signal layer health, SHAP-style causal drivers |
| **Predictions** | P10/P50/P90 probability bands — Iran Strike / US Escalation / Shipping |
| **Monte Carlo** | Up to 25,000 iterations, fan chart, K-means cluster analysis |
| **What-If Engine** | Real-time re-computation on 8 slider/toggle parameters |
| **Event Chains** | Causal DAG with conditional probabilities, 3 pathways |
| **Explainability** | SHAP-style attribution waterfall + natural-language reasoning |
| **Truth Tracker** | Brier score, calibration curve, prediction resolution log |
| **Ask Intel** | Natural-language Q&A grounded in current intelligence state |
| **Roadmap** | 4-phase implementation plan from source code audit |

### Live Feed

The dashboard fetches real articles on load and every 90 seconds from:

- **GDELT Project API** — free, no key required, CORS-enabled
- **RSS feeds** via rss2json.com — BBC World, Al Jazeera, DW (rotated)

Each article is parsed through a keyword-based NLP pipeline:
- `inferLocation()` — 29-entry keyword map → lat/lng geocoding
- `inferSeverity()` — High / Medium / Normal from keyword density
- `inferCategory()` — Military / Naval / Diplomacy / Economics / Politics / Proxy
- `inferTier()` — Tier-1 (Reuters/BBC) → Tier-3 (social)

Live article signal density drives the prediction model inputs in real time. If all API calls fail the system falls back to built-in seed data and shows a **SIMULATED** status badge.

---

## Full-Stack Next.js Application

### Features

- **Multi-layer live ingestion** (8 parallel provider types):
  - `core_news` — Reuters, AP, BBC, Al Jazeera, NYT
  - `osint_war` — Bellingcat, Oryx, DeepStateMap/Faytuks
  - `radar_air` — Flightradar24, RadarBox, ADS-B Exchange
  - `radar_naval` — MarineTraffic, VesselFinder
  - `social_x` / `social_reddit` — X account tracking, Reddit OSINT
  - `satellite` — Maxar, Planet, Google Earth signal feeds
  - `GDELT GKG 2.0` — event intelligence API
- **Prediction engine** — Bayesian-weighted logistic regression with sigmoid activation
- **Monte Carlo** — rolling simulation, P10/P50/P90 percentile bands
- **Discrete event chains** — Markov graph causal DAG
- **WebSocket streaming** — live push to all connected clients via Socket.io
- **Redis pub/sub** — multi-instance broadcast with in-memory fallback
- **Scenario modes** — `baseline` (×1.0) · `crisis` (×1.35) · `extreme` (×1.80)

### Architecture

```
Browser (React + Zustand + Recharts)
    │  WebSocket (Socket.io)
    ▼
server.mjs  (Next.js custom Node server)
    ├── /api/bootstrap     → GET initial state
    ├── /api/history       → GET rolling event log
    └── /api/scenario      → GET / POST scenario mode
    │
    ├── ingestion-service.js   → orchestrates all 8 providers
    ├── prediction-engine.js   → Bayesian sigmoid models
    ├── monte-carlo.js         → rolling MC simulation
    ├── discrete-event.js      → Markov event chain graph
    ├── intelligence.js        → tension / stress / anomaly
    ├── normalize.js           → event enrichment pipeline
    └── realtime-engine.js     → Socket.io broadcast loop
    │
Redis (optional)  →  in-memory fallback if unavailable
```

### Setup

**1. Install dependencies**
```bash
npm install
```

**2. Configure environment**
```bash
cp .env.example .env
# Edit .env — add optional API keys (NewsAPI, Alpha Vantage)
# All keys are optional; system runs in synthetic mode without them
```

**3. Optional — start Redis**
```bash
docker compose up -d redis
```

**4. Run**
```bash
npm run dev        # development (hot reload)
npm run build && npm start  # production
```

**5. Open**
```
http://localhost:3000
```

**One-click Mac launcher:** double-click `run.command`

### Environment Variables

```env
# .env.example — all keys optional
NEWSAPI_KEY=           # newsapi.org — free tier available
ALPHA_VANTAGE_KEY=     # alphavantage.co — free tier available
REDIS_URL=             # redis://localhost:6379 — leave blank to use in-memory
PORT=3000
```

### WebSocket Events

| Event | Payload |
|-------|---------|
| `news_update` | Normalised incoming event |
| `macro_update` | Live commodity + FX bar values |
| `simulation_update` | Rolling Monte Carlo + discrete event graph |
| `risk_update` | Geopolitics / macro stress / anomaly / composite risk |
| `prediction_update` | Live projections, confidence, drivers, forecast bands |
| `alert_update` | Threshold-triggered alert packets |
| `scenario_update` | Scenario change broadcast |

### Folder Structure

```
.
├── intelligence-platform.html   ← standalone dashboard (no install)
├── server.mjs                   ← custom Next.js Node server
├── run.command                  ← one-click Mac launcher
├── docker-compose.yml
├── .env.example
├── package.json
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── bootstrap/route.js
    │   │   ├── history/route.js
    │   │   └── scenario/route.js
    │   ├── globals.css
    │   ├── layout.js
    │   └── page.js
    ├── backend/
    │   ├── config.js
    │   ├── engine-registry.js
    │   ├── ingestion-service.js
    │   ├── normalize.js
    │   ├── realtime-engine.js
    │   ├── redis.js
    │   ├── snapshot.js
    │   ├── utils.js
    │   ├── providers/
    │   │   ├── macro-provider.js
    │   │   └── news-provider.js
    │   └── simulation/
    │       ├── discrete-event.js
    │       ├── intelligence.js
    │       ├── monte-carlo.js
    │       └── prediction-engine.js
    ├── components/
    │   ├── AlertsPanel.jsx
    │   ├── CommodityFxBarChart.jsx
    │   ├── LiveTicker.jsx
    │   ├── PredictionPanel.jsx
    │   ├── RegionHeatMap.jsx
    │   ├── ScenarioModeToggle.jsx
    │   ├── SentimentGauge.jsx
    │   └── SimulationChart.jsx
    ├── lib/
    │   ├── socket-client.js
    │   └── use-realtime-socket.js
    └── store/
        └── intel-store.js
```

---

## Known Gaps & Roadmap

See the **Roadmap** tab in the HTML dashboard or `GIP_Enhancement_Blueprint_v2.docx` for the full 4-phase plan.

| Gap | Current | Target |
|-----|---------|--------|
| Monte Carlo iterations | 1,200–2,400 | 10,000+ (worker threads) |
| Sentiment analysis | Keyword word-list | Transformer NLP (DistilBERT) |
| What-If engine | Static client-side shifts | Server-side full re-computation |
| Ingestion breadth | Single provider call | 8-provider parallel ingestion |
| Event chain depth | 3-step single path | N-step DAG, top-5 pathways |
| XAI depth | 3 signal labels | SHAP attribution + NL explanation |

---

## License

MIT — see `LICENSE`
