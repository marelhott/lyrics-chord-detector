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
pip install --no-cache-dir -r requirements.railway.txt
echo "=== Build Complete ==="
