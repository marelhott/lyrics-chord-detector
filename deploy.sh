#!/bin/bash

echo "🚀 Lyrics & Chord Detector - Automatický Deployment"
echo "=================================================="
echo ""

# Krok 1: Push na GitHub
echo "📤 Krok 1/3: Pushing na GitHub..."
git push
if [ $? -ne 0 ]; then
    echo "❌ Git push selhal. Zadej svoje GitHub credentials a zkus znovu."
    exit 1
fi
echo "✅ Push na GitHub úspěšný!"
echo ""

# Krok 2: Instrukce pro Render
echo "🔧 Krok 2/3: Deploy backend na Render.com"
echo "=================================================="
echo ""
echo "1. Otevři: https://render.com/"
echo "2. Přihlaš se přes GitHub"
echo "3. Klikni 'New +' → 'Web Service'"
echo "4. Vyber repo 'lyrics-chord-detector'"
echo "5. Render automaticky načte render.yaml → klikni 'Create Web Service'"
echo "6. Počkej 5-10 minut na build"
echo "7. Zkopíruj URL (např: https://lyrics-chord-detector-api.onrender.com)"
echo ""
read -p "Stiskni ENTER až budeš mít URL z Render... "
read -p "Zadej URL tvého Render backendu (včetně https://): " RENDER_URL
echo ""

if [ -z "$RENDER_URL" ]; then
    echo "❌ URL není zadána. Deployment zastaven."
    exit 1
fi

# Aktualizuj .env pro lokální testování
echo "VITE_API_URL=$RENDER_URL" > frontend/.env
echo "✅ .env aktualizován!"
echo ""

# Krok 3: Instrukce pro Netlify
echo "🌐 Krok 3/3: Update Netlify"
echo "=================================================="
echo ""
echo "1. Otevři: https://app.netlify.com/"
echo "2. Vyber svůj site (lyrics-chord-detector)"
echo "3. Jdi na: Site configuration → Environment variables"
echo "4. Přidej proměnnou:"
echo "   Key:   VITE_API_URL"
echo "   Value: $RENDER_URL"
echo "5. Save a pak: Deploys → Trigger deploy → Deploy site"
echo ""
echo "✨ HOTOVO! Za pár minut bude aplikace živá!"
echo ""
echo "Backend URL: $RENDER_URL"
echo "Frontend: Tvoje Netlify URL"
