# Lyrics & Chord Detector

Webová aplikace pro detekci textu písní a akordů z audio souborů (MP3/WAV).

**🎯 Spolehlivé AI-powered zpracování pomocí Python backendu**

## Funkce

- 🎵 Upload MP3 a WAV souborů
- 📝 Automatický přepis textu (speech-to-text) pomocí Whisper AI
- 🎸 Detekce základních akordů pomocí librosa
- 📄 Generování PDF s textem a akordy
- ⏱️ Zobrazení časových značek pro synchronizaci
- 🎨 Moderní UI inspirované nano-banana-pro-app

## Architektura

- **Frontend**: React + Vite + Tailwind CSS (Netlify)
- **Backend**: Python FastAPI + Whisper + Librosa (Railway/Render)

## Lokální spuštění

### Backend (Python)

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Backend poběží na `http://localhost:8000`

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Frontend poběží na `http://localhost:5173`

**Poznámka:** Backend stahuje Whisper model při prvním spuštění (~150MB).

## Deployment

### 1. Backend na Render.com (ZDARMA!)

1. **Vytvoř nový Web Service na Render:**
   - Jdi na https://render.com/
   - Klikni "New +" → "Web Service"
   - Připoj GitHub a vyber repozitář `lyrics-chord-detector`

2. **Nastav konfiguraci:**
   - Name: `lyrics-chord-detector-api`
   - Runtime: `Python 3`
   - Build Command: `pip install -r backend/requirements.txt`
   - Start Command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Instance Type: `Free`

3. **Deploy:**
   - Klikni "Create Web Service"
   - Počkej 5-10 minut (první build stahuje Whisper model ~150MB)
   - Zkopíruj URL (např. `https://lyrics-chord-detector-api.onrender.com`)

**Poznámka:** Free tier Render uspává service po 15 minutách neaktivity. První request po uspání trvá ~30s (cold start).

### 2. Frontend na Netlify (ZDARMA!)

1. **Připoj repozitář na Netlify:**
   - Jdi na https://app.netlify.com/
   - Klikni "Add new site" → "Import an existing project"
   - Vyber GitHub repozitář

2. **Nastav build settings:**
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **Nastav environment variables:**
   - Přidej `VITE_API_URL` s hodnotou URL tvého Render backendu
   - Např: `VITE_API_URL=https://lyrics-chord-detector-api.onrender.com`

4. **Deploy:**
   - Klikni "Deploy site"
   - Hotovo! 🎉

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000  # Lokálně
VITE_API_URL=https://your-backend.onrender.com  # Production
```

### Backend
Žádné environment variables nejsou potřeba pro základní funkčnost.

## Technologie

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling (Monstera color palette)
- **jsPDF** - PDF generování

### Backend
- **FastAPI** - Python web framework
- **Whisper** - OpenAI speech-to-text model
- **Librosa** - Audio analysis a chord detection
- **NumPy** - Numerické výpočty

## Použití

1. Otevři aplikaci v prohlížeči
2. Nahraj MP3 nebo WAV soubor (přetažením nebo kliknutím)
3. Klikni na "Analyzovat"
4. Počkej na zpracování (30s - 3min podle délky souboru)
5. Zobrazí se text, akordy a timeline
6. Klikni na "Stáhnout PDF" pro export výsledků

## API Endpoints

### POST /process-audio
Zpracuje audio soubor a vrátí text + akordy.

**Request:**
- `file`: audio soubor (MP3/WAV)

**Response:**
```json
{
  "success": true,
  "text": "Celý přepsaný text...",
  "segments": [
    {
      "text": "Segment textu",
      "start": 0.0,
      "end": 3.5
    }
  ],
  "chords": [
    {
      "chord": "Am",
      "time": 2.5,
      "confidence": 0.85
    }
  ]
}
```

### GET /health
Kontrola stavu API.

## Omezení

- Kvalita detekce závisí na kvalitě nahrávky
- Nejlépe funguje s čistým zpěvem a nástroji
- Detekce akordů je založená na chroma features (základní akordy)
- Doporučená délka souboru: do 10 minut

## License

MIT
