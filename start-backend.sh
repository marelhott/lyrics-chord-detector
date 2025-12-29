#!/bin/bash
cd "$(dirname "$0")/backend"

echo "🔧 Spouštím backend na http://localhost:8000"
echo ""

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start the server
python main.py
