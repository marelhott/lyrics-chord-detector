#!/bin/bash
set -e

echo "=== Installing Frontend Dependencies ==="
cd frontend
npm install

echo "=== Building Frontend ==="
npm run build

echo "=== Frontend Build Complete ==="
ls -la dist/

cd ..

echo "=== Installing Python Dependencies ==="
cd backend
echo "Current directory: $(pwd)"
ls -la requirements.txt || echo "requirements.txt NOT FOUND in $(pwd)"
pip install --no-cache-dir -r requirements.txt

echo "=== Build Complete ==="
