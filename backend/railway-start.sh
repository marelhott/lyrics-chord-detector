#!/bin/bash
# Railway deployment entrypoint - absolute path version
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
uvicorn main:app --host 0.0.0.0 --port $PORT
