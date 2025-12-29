#!/bin/bash
cd "$(dirname "$0")/frontend"

echo "🎨 Spouštím frontend na http://localhost:5173"
echo ""

# Start the dev server
npm run dev
