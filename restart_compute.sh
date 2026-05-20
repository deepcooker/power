#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-6111}"
WORKERS="${WORKERS:-1}"
APP_MODULE="${APP_MODULE:-api:app}"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$BASE_DIR/logs"
LOG_FILE="$LOG_DIR/compute_api.log"

mkdir -p "$LOG_DIR"

find_process() {
  lsof -t -i:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

PID="$(find_process)"
if [[ -n "$PID" ]]; then
  kill -TERM "$PID"
  for _ in {1..10}; do
    if ! ps -p "$PID" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if ps -p "$PID" >/dev/null 2>&1; then
    kill -KILL "$PID"
  fi
fi

if [[ -f "$LOG_FILE" ]]; then
  mv "$LOG_FILE" "$LOG_FILE.old"
fi

cd "$BASE_DIR"
nohup setsid python3 -m uvicorn "$APP_MODULE" --host "$HOST" --workers "$WORKERS" --port "$PORT" > "$LOG_FILE" 2>&1 < /dev/null &

for _ in {1..10}; do
  sleep 1
  PID="$(find_process)"
  if [[ -n "$PID" ]]; then
    echo "compute api started: pid=$PID port=$PORT log=$LOG_FILE"
    exit 0
  fi
done

echo "compute api failed to start; check $LOG_FILE" >&2
exit 1
