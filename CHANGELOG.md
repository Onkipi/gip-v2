# Changelog

All notable changes to the Geopolitical Intelligence Platform are documented here.

---

## [2.0.0] — 2025-04-05

### Added — Standalone HTML Dashboard (`intelligence-platform.html`)
- Self-contained single-file dashboard — open in any browser, no install
- **Map View tab** — 3-panel layout (live feed | Leaflet map | intel panel)
  - Leaflet.js dark CartoDB basemap centred on Middle East
  - 18+ incident markers colour-coded by severity (High/Medium/Normal)
  - Expandable live feed with search, region filter, category filter, severity toggle
  - Right panel: Prediction Evidence Graph, Escalation Path, Recommended Actions, Incident Detail
- **Live News Feed Engine**
  - GDELT Project API integration (free, no key, CORS-enabled, 6-hour window)
  - RSS via rss2json.com (BBC World, Al Jazeera, DW — rotated per cycle)
  - `inferLocation()` — 29-location keyword geocoder → lat/lng
  - `inferSeverity()` / `inferCategory()` / `inferTier()` / `inferRelevance()` NLP pipeline
  - Auto-refresh every 90 seconds with manual ↻ refresh button
  - Live / Simulated / Error status badge with timestamp
  - Prediction model inputs updated from real article signal density in real time
- **Expandable Signal Layers** — each of 8 layers now expands to show individual events with source, confidence %, UTC time, and impact weight in risk points
- **Causal Driver Narrative** — Top Prediction Drivers panel now shows `+12.4pp risk` causal attribution instead of vague correlation percentages
- **Truth Tracking Layer tab**
  - 12-entry resolved prediction log (Forecast P50 / Outcome YES/NO / Error / Brier per prediction)
  - Composite Brier score, binary accuracy %, calibration error
  - SVG calibration curve (forecast probability vs. observed frequency)
  - Performance breakdown by category (Strike / Shipping / Escalation)
  - Live pending predictions awaiting resolution
- **Ask Intel tab** — natural-language Q&A engine
  - 8 topic handlers: risk level, predictions, Iran, shipping, signal layers, crisis scenarios, naval, model accuracy
  - Responses grounded in live P50 values, feature attribution numbers, and Brier scores
  - Suggested questions with one-click shortcuts
- **Predictions tab** — P10/P50/P90 probability bands with fan chart (P10/P25/P50/P75/P90)
- **Monte Carlo tab** — up to 25,000 iterations, async chunked (500/chunk), histogram, trajectory fan chart, K-means cluster analysis
- **What-If Engine tab** — 5 sliders + 3 toggles, full sigmoid re-computation on every change, scenario save A/B/Baseline comparison
- **Event Chains tab** — 3 causal DAG pathways with SVG rendering and click-to-inspect steps
- **XAI / Explainability tab** — SHAP-style waterfall, epistemic/aleatoric decomposition, natural-language explanation
- **Roadmap tab** — 4-phase implementation plan grounded in source code audit

### Added — Architecture Audit & Blueprint
- `GIP_Enhancement_Blueprint_v2.docx` — 39KB Word document, 816 paragraphs, 11 sections
- Full gap analysis: Monte Carlo depth, sentiment quality, What-If engine, P50, ingestion breadth, XAI depth

---

## [1.0.0] — 2025-04-01

### Added — Next.js Full-Stack Application
- Custom Next.js 15 server (`server.mjs`) with Socket.io real-time engine
- Multi-layer ingestion service framework (8 provider types defined)
- Bayesian-weighted prediction engine with sigmoid activation
- Rolling Monte Carlo simulation (1,200–2,400 iterations)
- Discrete event Markov chain graph (3-step pathway)
- Intelligence layer — geopolitical tension, market stress, anomaly score
- Redis pub/sub with in-memory fallback
- WebSocket events: `news_update`, `macro_update`, `simulation_update`, `risk_update`, `prediction_update`, `alert_update`, `scenario_update`
- Scenario modes: `baseline` (×1.0), `crisis` (×1.35), `extreme` (×1.80)
- React dashboard with Zustand state management and Recharts visualizations
- RSS/Atom parsing, GDELT GKG 2.0, NewsAPI integration in provider layer
- Docker Compose configuration for Redis
- `.env.example` with NewsAPI and Alpha Vantage key slots

### Known Gaps at v1.0.0 (addressed in v2.0.0)
- Ingestion service only called single provider despite 8 being defined
- P50 percentile not computed (P10/P90 only)
- What-If engine used static hardcoded probability shifts
- Monte Carlo at 1,200 iterations default (2,400 for predictions)
- Sentiment scorer was keyword word-list with no negation handling
- `impact_score` was non-deterministic (`randomBetween(42,80)`)
