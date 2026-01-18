#!/bin/bash
set -e

echo "=== Building Frontend ==="
cd frontend
npm install
npm run build
cd ..

echo "=== Frontend build complete ==="
ls -la frontend/dist/

echo "=== Installing Python Dependencies ==="
python -m ensurepip --upgrade || true
python -m pip install --upgrade pip
python -m pip install --no-cache-dir -r backend/requirements.railway.txt

echo "=== Build Complete ==="
