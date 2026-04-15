#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  GIP v2 — One-Command Deploy to Railway
#  Usage: bash deploy.sh
# ═══════════════════════════════════════════════════════════════
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Geopolitical Intelligence Platform v2          ║${NC}"
echo -e "${CYAN}║   Railway Deploy Script                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check Node.js ────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org (v18+)${NC}"
  exit 1
fi
NODE_VER=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VER}${NC}"

# ── 2. Install Railway CLI if missing ───────────────────────────
if ! command -v railway &> /dev/null; then
  echo -e "${YELLOW}→ Installing Railway CLI...${NC}"
  npm install -g @railway/cli
fi
echo -e "${GREEN}✓ Railway CLI ready${NC}"

# ── 3. Login ────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}→ Opening Railway login (browser will open)...${NC}"
railway login

# ── 4. Init project ─────────────────────────────────────────────
echo ""
echo -e "${CYAN}→ Initialising Railway project...${NC}"
railway init --name "gip-v2"

# ── 5. Set environment variables ────────────────────────────────
echo ""
echo -e "${CYAN}→ Setting environment variables...${NC}"

railway variables set NODE_ENV=production
railway variables set HOST=0.0.0.0
railway variables set PORT=3000
railway variables set NEXT_PUBLIC_SOCKET_PATH=/socket.io
railway variables set APP_NAME="Geopolitical Intelligence Platform"

echo -e "${GREEN}✓ Core variables set${NC}"
echo ""
echo -e "${YELLOW}Optional: add API keys now for live news data${NC}"
echo -e "${YELLOW}  (press Enter to skip each one)${NC}"
echo ""

read -rp "  REDIS_URL (from upstash.com, or skip): " REDIS_URL_VAL
if [[ -n "$REDIS_URL_VAL" ]]; then
  railway variables set "REDIS_URL=${REDIS_URL_VAL}"
  echo -e "${GREEN}  ✓ Redis configured${NC}"
else
  echo -e "  → Skipped — app will run in in-memory mode"
fi

read -rp "  NEWS_API_KEY (from newsapi.org, or skip): " NEWS_API_KEY_VAL
if [[ -n "$NEWS_API_KEY_VAL" ]]; then
  railway variables set "NEWS_API_KEY=${NEWS_API_KEY_VAL}"
  echo -e "${GREEN}  ✓ NewsAPI key set${NC}"
fi

read -rp "  ALPHA_VANTAGE_API_KEY (or skip): " AV_KEY_VAL
if [[ -n "$AV_KEY_VAL" ]]; then
  railway variables set "ALPHA_VANTAGE_API_KEY=${AV_KEY_VAL}"
  echo -e "${GREEN}  ✓ Alpha Vantage key set${NC}"
fi

# ── 6. Deploy ───────────────────────────────────────────────────
echo ""
echo -e "${CYAN}→ Deploying to Railway (this takes ~2-3 minutes)...${NC}"
railway up --detach

# ── 7. Get URL ──────────────────────────────────────────────────
echo ""
echo -e "${CYAN}→ Generating public URL...${NC}"
railway domain

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Deployment complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Run ${CYAN}railway logs${NC} to watch the build logs"
echo -e "  Run ${CYAN}railway open${NC} to open the dashboard in browser"
echo -e "  Run ${CYAN}railway status${NC} to check deployment health"
echo ""
echo -e "${YELLOW}  Note: First build takes ~3 minutes (npm ci + next build)${NC}"
echo -e "${YELLOW}  The app is live once logs show 'listening at http://...'${NC}"
echo ""
