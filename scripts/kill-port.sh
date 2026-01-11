#!/bin/sh
# Kill processes listening on a TCP port (macOS-friendly) and wait until port is free
PORT=${1:-5000}
echo "Checking for processes on port $PORT"
PIDS=$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "Found PIDs listening on port $PORT: $PIDS"
  echo "Killing PIDs..."
  kill -9 $PIDS 2>/dev/null || true
  # wait until the port is free (max ~3s)
  for i in 1 2 3 4 5; do
    sleep 0.5
    if ! lsof -nP -iTCP:$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
      echo "Port $PORT is now free"
      exit 0
    fi
    echo "Waiting for port $PORT to free... ($i)"
  done
  echo "Port $PORT still in use after kill attempts"
  lsof -nP -iTCP:$PORT -sTCP:LISTEN || true
else
  echo "No processes on port $PORT"
fi

exit 0
