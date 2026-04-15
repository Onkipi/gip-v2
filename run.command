#!/bin/zsh
set -e

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting Real-Time Intelligence System on http://localhost:3000"
npm run dev
