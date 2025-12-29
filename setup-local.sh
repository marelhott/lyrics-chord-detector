#!/bin/bash

echo "🚀 Lyrics & Chord Detector - Kompletní lokální setup"
echo "===================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if Homebrew is installed
print_step "Kontroluji Homebrew..."
if ! command -v brew &> /dev/null; then
    print_step "Homebrew není nainstalovaný. Instaluji..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH (for Apple Silicon Macs)
    if [[ $(uname -m) == 'arm64' ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    else
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/usr/local/bin/brew shellenv)"
    fi

    print_success "Homebrew nainstalovaný!"
else
    print_success "Homebrew už je nainstalovaný"
fi

# Install ffmpeg
print_step "Instaluji ffmpeg..."
if ! command -v ffmpeg &> /dev/null; then
    brew install ffmpeg
    print_success "ffmpeg nainstalovaný!"
else
    print_success "ffmpeg už je nainstalovaný"
fi

# Install Node.js
print_step "Instaluji Node.js..."
if ! command -v node &> /dev/null; then
    brew install node
    print_success "Node.js nainstalovaný!"
else
    print_success "Node.js už je nainstalovaný (verze: $(node --version))"
fi

# Install Python dependencies for backend
print_step "Instaluji Python dependencies pro backend..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
print_success "Python dependencies nainstalovány!"
deactivate

# Install Node dependencies for frontend
print_step "Instaluji Node dependencies pro frontend..."
cd ../frontend
npm install
print_success "Node dependencies nainstalovány!"

cd ..

echo ""
echo "🎉 Instalace dokončena!"
echo ""
echo "📝 Jak spustit aplikaci:"
echo ""
echo "1️⃣  BACKEND (v jednom terminálu):"
echo "   cd /Users/mulenmara/Documents/Claude/lyrics-chord-detector/backend"
echo "   source venv/bin/activate"
echo "   python main.py"
echo ""
echo "2️⃣  FRONTEND (v druhém terminálu):"
echo "   cd /Users/mulenmara/Documents/Claude/lyrics-chord-detector/frontend"
echo "   npm run dev"
echo ""
echo "3️⃣  Otevři prohlížeč na: http://localhost:5173"
echo ""
echo "✅ Backend API: http://localhost:8000"
echo "✅ Frontend UI: http://localhost:5173"
echo ""
