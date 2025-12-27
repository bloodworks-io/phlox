#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from the repo root (works both locally and inside containers)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "[start.sh] Working directory: $(pwd)"

# Initialize demo DB if the script exists (non-fatal if it's missing in non-demo setups)
if [ -f "./server/demo/demo_db.py" ]; then
  echo "[start.sh] Initializing demo database..."
  python ./server/demo/demo_db.py
else
  echo "[start.sh] Skipping demo DB init (./server/demo/demo_db.py not found)"
fi

# Start Vite + FastAPI together.
# - Vite: bind to 0.0.0.0 so it's reachable from outside the container
# - Uvicorn: bind to 0.0.0.0 on port 5000
if command -v parallel >/dev/null 2>&1; then
  echo "[start.sh] Starting Vite + FastAPI via GNU parallel..."
  exec parallel --tag --line-buffer ::: \
    "npm run start-react -- --host 0.0.0.0 --port 3000" \
    "uvicorn server.server:app --reload --host 0.0.0.0 --port 5000"
else
  echo "[start.sh] GNU parallel not found; starting processes manually..."
  npm run start-react -- --host 0.0.0.0 --port 3000 &
  VITE_PID=$!
  uvicorn server.server:app --reload --host 0.0.0.0 --port 5000 &
  API_PID=$!

  # Exit if either process exits
  wait -n "${VITE_PID}" "${API_PID}"
fi
