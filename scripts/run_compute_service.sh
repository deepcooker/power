#!/usr/bin/env bash
set -u

ROOT_DIR="/root/power"
RUNTIME_DIR="$ROOT_DIR/runtime_data"
LOG_FILE="$RUNTIME_DIR/compute-6111.log"
LOCK_FILE="$RUNTIME_DIR/compute-6111.lock"

mkdir -p "$RUNTIME_DIR"
cd "$ROOT_DIR"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

while true; do
  python3 -m uvicorn api:app --host 0.0.0.0 --workers 1 --port 6111 >>"$LOG_FILE" 2>&1
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') service exited; restarting in 2 seconds" >>"$LOG_FILE"
  sleep 2
done
