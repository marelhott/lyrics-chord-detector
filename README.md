# Lyrics & Chord Detector

Webová aplikace pro detekci textu písní a akordů z audio souborů (MP3/WAV).

## Funkce

- 🎵 Upload MP3 a WAV souborů
- 📝 Automatický přepis textu (speech-to-text) pomocí OpenAI Whisper
- 🎸 Detekce základních akordů pomocí librosa
- 📄 Generování PDF s textem a akordy
- ⏱️ Zobrazení časových značek pro synchronizaci

## Struktura projektu

```
lyrics-chord-detector/
├── frontend/          # React + Vite frontend (deploy na Netlify)
└── backend/           # Python FastAPI backend (deploy na Railway/Render)
```

## Lokální spuštění

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Na Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Backend poběží na `http://localhost:8000`

**Poznámka:** První spuštění může trvat déle, protože Whisper stahuje model (~150MB).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend poběží na `http://localhost:5173`

## Deployment

### Frontend (Netlify)

1. Pushni kód na GitHub
2. Připoj repozitář na Netlify
3. Nastav build settings:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
4. Přidej environment variable:
   - `VITE_API_URL` = URL tvého backend API

### Backend (Railway nebo Render)

**Railway:**
1. Vytvoř nový projekt na Railway
2. Připoj GitHub repozitář
3. Nastav Root Directory na `backend`
4. Railway automaticky detekuje Python a spustí aplikaci

**Render:**
1. Vytvoř nový Web Service
2. Připoj GitHub repozitář
3. Nastav:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Technologie

### Frontend
- React 18
- Vite
- Tailwind CSS
- jsPDF
- Axios

### Backend
- FastAPI
- OpenAI Whisper (offline)
- Librosa
- NumPy
- SciPy

## Použití

1. Otevři aplikaci v prohlížeči
2. Klikni na "Select Audio File" a vyber MP3 nebo WAV soubor
3. Klikni na "Process Audio"
4. Počkej na zpracování (může trvat 30s - 2min podle délky souboru)
5. Zobrazí se text, akordy a timeline
6. Klikni na "Download PDF" pro stažení výsledků

## Omezení

- Kvalita detekce závisí na kvalitě nahrávky
- Nejlépe funguje s čistým zpěvem a nástroji
- Detekce akordů je základní (dur, moll, může mít nepřesnosti)
- Doporučená délka souboru: do 5 minut

## License

MIT
